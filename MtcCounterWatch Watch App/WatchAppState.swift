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

    private let defaults: UserDefaults

    init() {
        self.defaults = UserDefaults(suiteName: WatchAppState.appGroupSuite) ?? .standard
        loadData()
    }

    func addRound() {
        let round = Round(male: male, female: female, timestamp: Date())
        rounds.append(round)
        male = 0
        female = 0
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
