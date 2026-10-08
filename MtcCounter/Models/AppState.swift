import SwiftUI
import Combine

class AppState: ObservableObject {
    static let appGroupSuite = "group.com.mtc.counter"

    // Live counts are saved on every change, so an in-progress count
    // survives the app being closed or killed mid-service.
    @Published var male: Int = 0 { didSet { saveLiveCounts() } }
    @Published var female: Int = 0 { didSet { saveLiveCounts() } }
    @Published var rounds: [Round] = []
    @Published var records: [AttendanceRecord] = []
    @Published var celebrants: [String] = []
    @Published var parishes: [String] = []

    /// Parish and celebrant last used, offered again for the next service.
    @Published var lastParish: String = ""
    @Published var lastCelebrant: String = ""

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

    // MARK: - Round Management

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

    // MARK: - Record Management

    func saveRecord(date: String, isoDate: String = "", service: String = "", parish: String, celebrant: String,
                    coCelebrants: String, sermon: String, scripture: String, notes: String) {
        let record = AttendanceRecord(
            date: date.isEmpty ? formattedToday() : date,
            isoDate: isoDate,
            service: service.trimmingCharacters(in: .whitespaces),
            parish: parish,
            celebrant: celebrant,
            coCelebrants: coCelebrants,
            sermon: sermon,
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
        rememberLastDetails(parish: parish, celebrant: celebrant)
    }

    func rememberLastDetails(parish: String, celebrant: String) {
        if !parish.isEmpty { lastParish = parish }
        if !celebrant.isEmpty { lastCelebrant = celebrant }
        defaults.set(lastParish, forKey: "mtc_last_parish")
        defaults.set(lastCelebrant, forKey: "mtc_last_celebrant")
    }

    /// Removes every record and saves that (the list used to be emptied
    /// without saving, so the records came back on the next launch).
    func clearAllRecords() {
        records.removeAll()
        saveRecords()
    }

    func deleteRecord(id: UUID) {
        records.removeAll { $0.id == id }
        saveRecords()
    }

    // MARK: - Celebrant Management

    func addCelebrant(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !celebrants.contains(trimmed) else { return }
        celebrants.append(trimmed)
        celebrants.sort()
        saveCelebrants()
    }

    func deleteCelebrant(_ name: String) {
        celebrants.removeAll { $0 == name }
        saveCelebrants()
    }

    // MARK: - Parish Management

    func addParish(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, !parishes.contains(trimmed) else { return }
        parishes.append(trimmed)
        parishes.sort()
        saveParishes()
    }

    func deleteParish(_ name: String) {
        parishes.removeAll { $0 == name }
        saveParishes()
    }

    // MARK: - Persistence

    private func saveLiveCounts() {
        defaults.set(male, forKey: "mtc_live_male")
        defaults.set(female, forKey: "mtc_live_female")
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

    private func saveCelebrants() {
        if let data = try? JSONEncoder().encode(celebrants) {
            defaults.set(data, forKey: "mtc_celebrants")
        }
    }

    private func saveParishes() {
        if let data = try? JSONEncoder().encode(parishes) {
            defaults.set(data, forKey: "mtc_parishes")
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
        if let data = defaults.data(forKey: "mtc_celebrants"),
           let decoded = try? JSONDecoder().decode([String].self, from: data) {
            celebrants = decoded
        }
        if let data = defaults.data(forKey: "mtc_parishes"),
           let decoded = try? JSONDecoder().decode([String].self, from: data) {
            parishes = decoded
        }
        male = max(0, defaults.integer(forKey: "mtc_live_male"))
        female = max(0, defaults.integer(forKey: "mtc_live_female"))
        lastParish = defaults.string(forKey: "mtc_last_parish") ?? ""
        lastCelebrant = defaults.string(forKey: "mtc_last_celebrant") ?? ""
    }

    // MARK: - Backup (web app format)

    /// JSON backup in the web app's format.
    func exportBackup() throws -> Data {
        try BackupCodec.encode(records: records, celebrants: celebrants, parishes: parishes)
    }

    /// Merges a backup file (from this app or the web app). Returns how many
    /// records were added or replaced.
    @discardableResult
    func importBackup(_ data: Data) throws -> Int {
        let backup = try BackupCodec.decode(data)
        let merged = BackupCodec.merge(local: records, localCelebrants: celebrants,
                                       localParishes: parishes, backup: backup)
        records = merged.records
        celebrants = merged.celebrants
        parishes = merged.parishes
        saveRecords()
        saveCelebrants()
        saveParishes()
        return merged.changed
    }

    // MARK: - Helpers

    private func formattedToday() -> String {
        let f = DateFormatter()
        f.dateStyle = .long
        return f.string(from: Date())
    }

    // MARK: - Export

    func exportCSV() -> String {
        var csv = "Date,Service,Parish,Celebrant,Co-Celebrants,Sermon,Scripture,Male,Female,Total,Rounds,Notes\n"
        for record in records {
            let row = [
                record.date, record.service, record.parish, record.celebrant, record.coCelebrants,
                record.sermon, record.scriptureReference,
                "\(record.totalMale)", "\(record.totalFemale)", "\(record.total)",
                "\(record.rounds.count)", record.notes
            ]
            .map { "\"\($0.replacingOccurrences(of: "\"", with: "\"\""))\"" }
            .joined(separator: ",")
            csv += row + "\n"
        }
        return csv
    }
}
