import Foundation

struct Round: Codable, Identifiable {
    var id: UUID = UUID()
    var male: Int
    var female: Int
    var timestamp: Date

    var total: Int { male + female }
}
