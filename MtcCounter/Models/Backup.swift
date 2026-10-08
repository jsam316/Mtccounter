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

    enum CodingKeys: String, CodingKey {
        case date, service, parishName, celebrant, coCelebrants, sermon, scripture
        case male, female, total, rounds, timestamp, notes
    }

    init(date: String, service: String?, parishName: String?, celebrant: String?, coCelebrants: String?,
         sermon: String?, scripture: String?, male: Int, female: Int, total: Int?, rounds: [WebRound]?,
         timestamp: String?, notes: String?) {
        self.date = date; self.service = service; self.parishName = parishName; self.celebrant = celebrant
        self.coCelebrants = coCelebrants; self.sermon = sermon; self.scripture = scripture
        self.male = male; self.female = female; self.total = total; self.rounds = rounds
        self.timestamp = timestamp; self.notes = notes
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
        date = try c.decode(String.self, forKey: .date)
        service = try c.decodeIfPresent(String.self, forKey: .service)
        parishName = try c.decodeIfPresent(String.self, forKey: .parishName)
        celebrant = try c.decodeIfPresent(String.self, forKey: .celebrant)
        coCelebrants = try c.decodeIfPresent(String.self, forKey: .coCelebrants)
        sermon = try c.decodeIfPresent(String.self, forKey: .sermon)
        scripture = try c.decodeIfPresent(String.self, forKey: .scripture)
        male = int(.male)
        female = int(.female)
        total = (try? c.decode(Int.self, forKey: .total)) ?? male + female
        rounds = try? c.decodeIfPresent([WebRound].self, forKey: .rounds)
        timestamp = try c.decodeIfPresent(String.self, forKey: .timestamp)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
    }
}

enum BackupError: Error { case notAnMtcBackup }

enum BackupCodec {
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
            notes: r.notes.isEmpty ? nil : r.notes
        )
    }

    static func attendanceRecord(from w: WebRecord) -> AttendanceRecord {
        let isISO = Lectionary.date(fromISO: w.date) != nil
        return AttendanceRecord(
            date: isISO ? displayDate(fromISO: w.date) : w.date,
            isoDate: isISO ? w.date : "",
            service: w.service ?? "",
            parish: w.parishName ?? "",
            celebrant: w.celebrant ?? "",
            coCelebrants: w.coCelebrants ?? "",
            sermon: w.sermon ?? "",
            scriptureReference: w.scripture ?? "",
            rounds: (w.rounds ?? []).map {
                Round(male: $0.male, female: $0.female, timestamp: parseTimestamp($0.timestamp) ?? Date(timeIntervalSince1970: 0))
            },
            totalMale: w.male,
            totalFemale: w.female,
            notes: w.notes ?? "",
            savedDate: parseTimestamp(w.timestamp) ?? Date(timeIntervalSince1970: 0)
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
        for w in backup.data.mtcHistory {
            let incoming = attendanceRecord(from: w)
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
            Array(Set(a + (b ?? [])).filter { !$0.isEmpty }).sorted()
        }
        return (records, union(localCelebrants, backup.data.savedCelebrants),
                union(localParishes, backup.data.savedParishes), changed)
    }
}
