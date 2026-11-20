import Foundation
import Combine

class WatchAppState: ObservableObject {
    static let appGroupSuite = "group.com.mtc.counter"

    // Saved on every change, so a count survives the app being closed.
    @Published var male: Int = 0 { didSet { saveLiveCounts() } }
    @Published var female: Int = 0 { didSet { saveLiveCounts() } }
    @Published var rounds: [Round] = []

    var total: Int { male + female }
    var roundMaleTotal: Int { rounds.reduce(0) { $0 + $1.male } }
    var roundFemaleTotal: Int { rounds.reduce(0) { $0 + $1.female } }
    var roundTotal: Int { rounds.reduce(0) { $0 + $1.total } }
    var grandTotal: Int { roundTotal + total }
    var grandMale: Int { roundMaleTotal + male }
    var grandFemale: Int { roundFemaleTotal + female }

    private let defaults: UserDefaults

    init() {
        self.defaults = UserDefaults(suiteName: WatchAppState.appGroupSuite) ?? .standard
        loadData()
    }

    /// Banks the current count as a round. Returns false (and adds nothing)
    /// when nothing has been counted, so there are no empty rounds.
    @discardableResult
    func addRound() -> Bool {
        guard male > 0 || female > 0 else { return false }
        let round = Round(male: male, female: female, timestamp: Date())
        rounds.append(round)
        male = 0
        female = 0
        saveRounds()
        return true
    }

    /// Removes one round (a miscount) and leaves the others.
    func removeRound(id: UUID) {
        rounds.removeAll { $0.id == id }
        saveRounds()
    }

    func clearRounds() {
        rounds.removeAll()
        male = 0
        female = 0
        saveRounds()
    }

    private func saveLiveCounts() {
        defaults.set(male, forKey: "mtc_watch_live_male")
        defaults.set(female, forKey: "mtc_watch_live_female")
    }

    private func saveRounds() {
        if let data = try? JSONEncoder().encode(rounds) {
            defaults.set(data, forKey: "mtc_rounds")
        }
    }

    private func loadData() {
        if let data = defaults.data(forKey: "mtc_rounds"),
           let decoded = try? JSONDecoder().decode([Round].self, from: data) {
            rounds = decoded
        }
        male = max(0, defaults.integer(forKey: "mtc_watch_live_male"))
        female = max(0, defaults.integer(forKey: "mtc_watch_live_female"))
    }
}
