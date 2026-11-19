import Foundation

/// Backup file in the web app's format, so a backup made on the iPhone can be
/// restored in the web app (which backs up to Google Drive) and vice versa:
///
///   { "version": "1.0", "app": "MTC Counter", "exportedAt": "...",
///     "data": { "mtcHistory": [...], "savedCelebrants": [...], "savedParishes": [...] } }
struct WebBackup: Codable {
    var version: String = "1.0"
    var exportedAt: String
    var app: String = "MTC Counter"
    var data: Payload

    struct Payload: Codable {
        var mtcHistory: [WebRecord]
        var savedCelebrants: [String]?
        var savedParishes: [String]?
    }
}

/// One list entry that may be malformed: it decodes to nil instead of
/// making the whole backup unreadable.
struct Lossy<T: Decodable>: Decodable {
    let value: T?
    init(from decoder: Decoder) throws { value = try? T(from: decoder) }
}

extension WebBackup.Payload {
    /// Lenient: unusable records and names are skipped, not fatal.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        mtcHistory = ((try? c.decode([Lossy<WebRecord>].self, forKey: .mtcHistory)) ?? []).compactMap { $0.value }
        savedCelebrants = (try? c.decode([Lossy<String>].self, forKey: .savedCelebrants))?.compactMap { $0.value }
        savedParishes = (try? c.decode([Lossy<String>].self, forKey: .savedParishes))?.compactMap { $0.value }
    }
}

struct WebRound: Codable {
    var male: Int
    var female: Int
    var total: Int?
    var timestamp: String?
}

/// One record as the web app stores it. Fields it may omit are optional;
/// `notes` exists only in iOS records and is carried through untouched.
struct WebRecord: Codable {
    var date: String
    var service: String?
    var parishName: String?
    var celebrant: String?
    var coCelebrants: String?
    var sermon: String?
    var scripture: String?
    var male: Int
    var female: Int
    var total: Int?
    var rounds: [WebRound]?
    var timestamp: String?
    var notes: String?
    /// The offertory counting sheet, in the web app's own shape.
    var offertory: Offertory?

    enum CodingKeys: String, CodingKey {
        case date, service, parishName, celebrant, coCelebrants, sermon, scripture
        case male, female, total, rounds, timestamp, notes, offertory
    }

    init(date: String, service: String?, parishName: String?, celebrant: String?, coCelebrants: String?,
         sermon: String?, scripture: String?, male: Int, female: Int, total: Int?, rounds: [WebRound]?,
         timestamp: String?, notes: String?, offertory: Offertory? = nil) {
        self.date = date; self.service = service; self.parishName = parishName; self.celebrant = celebrant
        self.coCelebrants = coCelebrants; self.sermon = sermon; self.scripture = scripture
        self.male = male; self.female = female; self.total = total; self.rounds = rounds
        self.timestamp = timestamp; self.notes = notes; self.offertory = offertory
    }

    /// Lenient decoding: numbers may have been stored as text by older versions.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func int(_ k: CodingKeys) -> Int {
            if let v = try? c.decode(Int.self, forKey: k) { return v }
            if let v = try? c.decode(Double.self, forKey: k) { return Int(v) }
            if let v = try? c.decode(String.self, forKey: k), let n = Int(v) { return n }
            return 0
        }
        // A text field of the wrong type is treated as absent, not as an error.
        func text(_ k: CodingKeys) -> String? { try? c.decode(String.self, forKey: k) }
        date = try c.decode(String.self, forKey: .date)
        service = text(.service)
        parishName = text(.parishName)
        celebrant = text(.celebrant)
        coCelebrants = text(.coCelebrants)
        sermon = text(.sermon)
        scripture = text(.scripture)
        male = int(.male)
        female = int(.female)
        total = male + female
        rounds = (try? c.decode([Lossy<WebRound>].self, forKey: .rounds))?.compactMap { $0.value }
        timestamp = text(.timestamp)
        notes = text(.notes)
        offertory = (try? c.decodeIfPresent(Offertory.self, forKey: .offertory)) ?? nil
    }
}

enum BackupError: Error { case notAnMtcBackup, tooLarge }

enum BackupCodec {
    // Limits on what a backup may contain (the same as the web app's).
    static let maxFileBytes = 5 * 1024 * 1024
    static let maxRecords = 5000
    static let maxNames = 500
    static let maxRounds = 500
    static let maxCount = 1_000_000

    /// A short piece of text from a backup: control characters removed,
    /// trimmed and capped.
    static func cleanText(_ value: String?, _ max: Int) -> String {
        let kept = (value ?? "").unicodeScalars.filter { $0 == "\n" || $0 == "\t" || !CharacterSet.controlCharacters.contains($0) }
        return String(String(String.UnicodeScalarView(kept)).trimmingCharacters(in: .whitespacesAndNewlines).prefix(max))
    }

    static func cleanCount(_ n: Int) -> Int { min(max(0, n), maxCount) }

    /// A list of names: non-empty text, no repeats, capped.
    static func cleanNames(_ names: [String]?) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for raw in names ?? [] {
            let name = cleanText(raw, 120)
            if name.isEmpty || seen.contains(name) { continue }
            seen.insert(name)
            out.append(name)
            if out.count == maxNames { break }
        }
        return out
    }

    /// One text cell for a CSV file. A cell that starts with = + - @ gets a
    /// leading apostrophe, so a spreadsheet shows it as text instead of
    /// running it as a formula.
    static func csvCell(_ value: String) -> String {
        var s = value
        if let first = s.first, "=+-@\t\r".contains(first) { s = "'" + s }
        return "\"" + s.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }
    private static let iso8601: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let iso8601NoFraction = ISO8601DateFormatter()

    static func parseTimestamp(_ s: String?) -> Date? {
        guard let s else { return nil }
        return iso8601.date(from: s) ?? iso8601NoFraction.date(from: s)
    }

    static func displayDate(fromISO iso: String) -> String {
        guard let d = Lectionary.date(fromISO: iso) else { return iso }
        let f = DateFormatter()
        f.dateStyle = .long
        return f.string(from: d)
    }

    static func webRecord(from r: AttendanceRecord) -> WebRecord {
        WebRecord(
            date: r.resolvedISODate ?? r.date,
            service: r.service,
            parishName: r.parish,
            celebrant: r.celebrant,
            coCelebrants: r.coCelebrants,
            sermon: r.sermon,
            scripture: r.scriptureReference,
            male: r.totalMale,
            female: r.totalFemale,
            total: r.total,
            rounds: r.rounds.map { WebRound(male: $0.male, female: $0.female, total: $0.total, timestamp: iso8601.string(from: $0.timestamp)) },
            timestamp: iso8601.string(from: r.savedDate),
            notes: r.notes.isEmpty ? nil : r.notes,
            offertory: r.offertory
        )
    }

    /// A record rebuilt from a backup with every value checked for size and
    /// range; nil when it has no usable date.
    static func attendanceRecord(from w: WebRecord) -> AttendanceRecord? {
        let date = cleanText(w.date, 60)
        guard !date.isEmpty else { return nil }
        let isISO = Lectionary.date(fromISO: date) != nil
        var sheet = w.offertory
        sheet?.normalize()
        return AttendanceRecord(
            date: isISO ? displayDate(fromISO: date) : date,
            isoDate: isISO ? date : "",
            service: cleanText(w.service, 60),
            parish: cleanText(w.parishName, 120),
            celebrant: cleanText(w.celebrant, 120),
            coCelebrants: cleanText(w.coCelebrants, 400),
            sermon: cleanText(w.sermon, 200),
            scriptureReference: cleanText(w.scripture, 80),
            rounds: (w.rounds ?? []).prefix(maxRounds).map {
                Round(male: cleanCount($0.male), female: cleanCount($0.female),
                      timestamp: parseTimestamp($0.timestamp) ?? Date(timeIntervalSince1970: 0))
            },
            totalMale: cleanCount(w.male),
            totalFemale: cleanCount(w.female),
            notes: cleanText(w.notes, 2000),
            savedDate: parseTimestamp(w.timestamp) ?? Date(timeIntervalSince1970: 0),
            offertory: (sheet?.isEmpty ?? true) ? nil : sheet
        )
    }

    static func encode(records: [AttendanceRecord], celebrants: [String], parishes: [String], now: Date = Date()) throws -> Data {
        let backup = WebBackup(
            exportedAt: iso8601.string(from: now),
            data: .init(mtcHistory: records.map(webRecord(from:)), savedCelebrants: celebrants, savedParishes: parishes)
        )
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try enc.encode(backup)
    }

    static func decode(_ data: Data) throws -> WebBackup {
        // A real backup is a few hundred KB at most; refuse anything huge.
        guard data.count <= maxFileBytes else { throw BackupError.tooLarge }
        let backup = try JSONDecoder().decode(WebBackup.self, from: data)
        guard backup.app == "MTC Counter" else { throw BackupError.notAnMtcBackup }
        return backup
    }

    /// Merge a backup into existing data with the web app's rules: records
    /// match on date + service, the newer one wins, nothing is ever deleted,
    /// and name lists are combined.
    static func merge(local: [AttendanceRecord], localCelebrants: [String], localParishes: [String],
                      backup: WebBackup)
        -> (records: [AttendanceRecord], celebrants: [String], parishes: [String], changed: Int) {
        var byKey: [String: AttendanceRecord] = [:]
        var order: [String] = []
        for r in local where byKey[r.mergeKey] == nil {
            byKey[r.mergeKey] = r
            order.append(r.mergeKey)
        }
        var changed = 0
        for w in backup.data.mtcHistory.prefix(maxRecords) {
            guard let incoming = attendanceRecord(from: w) else { continue }
            let key = incoming.mergeKey
            if let existing = byKey[key] {
                if incoming.savedDate > existing.savedDate {
                    var replacement = incoming
                    replacement.id = existing.id
                    byKey[key] = replacement
                    changed += 1
                }
            } else {
                byKey[key] = incoming
                order.append(key)
                changed += 1
            }
        }
        // Newest service first, as the History list shows them.
        let records = order.compactMap { byKey[$0] }.sorted {
            ($0.resolvedISODate ?? "") > ($1.resolvedISODate ?? "")
        }
        let union: ([String], [String]?) -> [String] = { a, b in
            Array(Set(a + cleanNames(b)).filter { !$0.isEmpty }).sorted()
        }
        return (records, union(localCelebrants, backup.data.savedCelebrants),
                union(localParishes, backup.data.savedParishes), changed)
    }
}
