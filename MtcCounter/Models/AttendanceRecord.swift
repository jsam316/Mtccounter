import Foundation

struct Round: Codable, Identifiable {
    var id: UUID = UUID()
    var male: Int
    var female: Int
    var timestamp: Date

    var total: Int { male + female }
}

struct AttendanceRecord: Codable, Identifiable {
    var id: UUID = UUID()
    /// Display date, e.g. "October 4, 2026" (kept for older records).
    var date: String
    /// Machine-readable date "2026-10-04"; empty on records saved before it existed.
    var isoDate: String
    /// Optional service label (Morning, Evening…). Several services can be
    /// recorded on one date; blank means the main service.
    var service: String
    var parish: String
    var celebrant: String
    var coCelebrants: String
    var sermon: String
    var scriptureReference: String
    var rounds: [Round]
    var totalMale: Int
    var totalFemale: Int
    var notes: String
    var savedDate: Date

    var total: Int { totalMale + totalFemale }

    // Backward-compatibility init with default values for new fields
    init(id: UUID = UUID(), date: String, isoDate: String = "", service: String = "", parish: String = "", celebrant: String,
         coCelebrants: String = "", sermon: String = "", scriptureReference: String,
         rounds: [Round], totalMale: Int, totalFemale: Int, notes: String, savedDate: Date) {
        self.id = id
        self.date = date
        self.isoDate = isoDate
        self.service = service
        self.parish = parish
        self.celebrant = celebrant
        self.coCelebrants = coCelebrants
        self.sermon = sermon
        self.scriptureReference = scriptureReference
        self.rounds = rounds
        self.totalMale = totalMale
        self.totalFemale = totalFemale
        self.notes = notes
        self.savedDate = savedDate
    }

    // Codable conformance with backward-compatible decoding
    enum CodingKeys: String, CodingKey {
        case id, date, isoDate, service, parish, celebrant, coCelebrants, sermon, scriptureReference
        case rounds, totalMale, totalFemale, notes, savedDate
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        date = try container.decode(String.self, forKey: .date)
        isoDate = try container.decodeIfPresent(String.self, forKey: .isoDate) ?? ""
        service = try container.decodeIfPresent(String.self, forKey: .service) ?? ""
        parish = try container.decodeIfPresent(String.self, forKey: .parish) ?? ""
        celebrant = try container.decodeIfPresent(String.self, forKey: .celebrant) ?? ""
        coCelebrants = try container.decodeIfPresent(String.self, forKey: .coCelebrants) ?? ""
        sermon = try container.decodeIfPresent(String.self, forKey: .sermon) ?? ""
        scriptureReference = try container.decodeIfPresent(String.self, forKey: .scriptureReference) ?? ""
        rounds = try container.decodeIfPresent([Round].self, forKey: .rounds) ?? []
        totalMale = try container.decode(Int.self, forKey: .totalMale)
        totalFemale = try container.decode(Int.self, forKey: .totalFemale)
        notes = try container.decodeIfPresent(String.self, forKey: .notes) ?? ""
        savedDate = try container.decode(Date.self, forKey: .savedDate)
    }
}

extension AttendanceRecord {
    /// "2026-10-04", from `isoDate` or, for older records, by reading the
    /// display date. nil when it can't be worked out.
    var resolvedISODate: String? {
        if !isoDate.isEmpty { return isoDate }
        for style in [DateFormatter.Style.long, .medium, .full] {
            for locale in [Locale.current, Locale(identifier: "en_US")] {
                let f = DateFormatter()
                f.locale = locale
                f.dateStyle = style
                if let d = f.date(from: date) { return Lectionary.isoString(d) }
            }
        }
        return nil
    }

    /// Identity used when merging backups: date + service, like the web app.
    var mergeKey: String {
        (resolvedISODate ?? date) + "|" + service.trimmingCharacters(in: .whitespaces).lowercased()
    }
}
