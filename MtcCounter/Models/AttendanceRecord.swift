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
    var celebrant: String
    var parish: String
    var scriptureReference: String
    var rounds: [Round]
    var totalMale: Int
    var totalFemale: Int
    var notes: String
    var savedDate: Date

    var total: Int { totalMale + totalFemale }
}
