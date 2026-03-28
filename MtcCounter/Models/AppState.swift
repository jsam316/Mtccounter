import SwiftUI
import Combine

class AppState: ObservableObject {
    static let appGroupSuite = "group.com.mtc.counter"

    @Published var male: Int = 0
    @Published var female: Int = 0
    @Published var rounds: [Round] = []
    @Published var records: [AttendanceRecord] = []

    var total: Int { male + female }
    var roundMaleTotal: Int { rounds.reduce(0) { $0 + $1.male } }
    var roundFemaleTotal: Int { rounds.reduce(0) { $0 + $1.female } }
    var roundTotal: Int { rounds.reduce(0) { $0 + $1.total } }
    var grandMale: Int { roundMaleTotal + male }
    var grandFemale: Int { roundFemaleTotal + female }
    var grandTotal: Int { grandMale + grandFemale }

    private let defaults: UserDefaults

    init() {
        self.defaults = UserDefaults(suiteName: AppState.appGroupSuite) ?? .standard
        loadData()
    }

    func addRound() {
        let round = Round(male: male, female: female, timestamp: Date())
        rounds.append(round)
        male = 0
        female = 0
        saveRounds()
    }

    func removeRound(at offsets: IndexSet) {
        rounds.remove(atOffsets: offsets)
        saveRounds()
    }

    func clearRounds() {
        rounds.removeAll()
        male = 0
        female = 0
        saveRounds()
    }

    func saveRecord(date: String, celebrant: String, parish: String,
                    scripture: String, notes: String) {
        let record = AttendanceRecord(
            date: date.isEmpty ? formattedToday() : date,
            celebrant: celebrant,
            parish: parish,
            scriptureReference: scripture,
            rounds: rounds,
            totalMale: grandMale,
            totalFemale: grandFemale,
            notes: notes,
            savedDate: Date()
        )
        records.insert(record, at: 0)
        clearRounds()
        saveRecords()
    }

    func deleteRecord(id: UUID) {
        records.removeAll { $0.id == id }
        saveRecords()
    }

    private func saveRounds() {
        if let data = try? JSONEncoder().encode(rounds) {
            defaults.set(data, forKey: "mtc_rounds")
        }
    }

    private func saveRecords() {
        if let data = try? JSONEncoder().encode(records) {
            defaults.set(data, forKey: "mtc_records")
        }
    }

    private func loadData() {
        if let data = defaults.data(forKey: "mtc_rounds"),
           let decoded = try? JSONDecoder().decode([Round].self, from: data) {
            rounds = decoded
        }
        if let data = defaults.data(forKey: "mtc_records"),
           let decoded = try? JSONDecoder().decode([AttendanceRecord].self, from: data) {
            records = decoded
        }
    }

    private func formattedToday() -> String {
        let f = DateFormatter()
        f.dateStyle = .long
        return f.string(from: Date())
    }
}
