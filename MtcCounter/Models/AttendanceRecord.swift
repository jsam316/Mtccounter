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
    var date: String
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
    init(id: UUID = UUID(), date: String, parish: String = "", celebrant: String,
         coCelebrants: String = "", sermon: String = "", scriptureReference: String,
         rounds: [Round], totalMale: Int, totalFemale: Int, notes: String, savedDate: Date) {
        self.id = id
        self.date = date
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
        case id, date, parish, celebrant, coCelebrants, sermon, scriptureReference
        case rounds, totalMale, totalFemale, notes, savedDate
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        date = try container.decode(String.self, forKey: .date)
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
