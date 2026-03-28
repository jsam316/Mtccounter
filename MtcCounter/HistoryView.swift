import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var appState: AppState
    @State private var searchText = ""

    var filteredRecords: [AttendanceRecord] {
        guard !searchText.isEmpty else { return appState.records }
        return appState.records.filter {
            $0.celebrant.localizedCaseInsensitiveContains(searchText) ||
            $0.parish.localizedCaseInsensitiveContains(searchText) ||
            $0.date.localizedCaseInsensitiveContains(searchText) ||
            $0.scriptureReference.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationView {
            Group {
                if appState.records.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "clock.badge.questionmark")
                            .font(.system(size: 64))
                            .foregroundColor(.secondary)
                        Text("No records yet")
                            .font(.title3)
                            .foregroundColor(.secondary)
                        Text("Save your first attendance record from the Counter tab.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(filteredRecords) { record in
                            NavigationLink(destination: RecordDetailView(record: record)) {
                                RecordRow(record: record)
                            }
                        }
                        .onDelete { offsets in
                            let ids = offsets.map { filteredRecords[$0].id }
                            ids.forEach { appState.deleteRecord(id: $0) }
                        }
                    }
                    .searchable(text: $searchText, prompt: "Search by date, celebrant, parish…")
                }
            }
            .navigationTitle("History")
        }
    }
}

// MARK: - Record Row

struct RecordRow: View {
    let record: AttendanceRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(record.date)
                    .font(.headline)
                Spacer()
                Text("\(record.total)")
                    .font(.title3.bold())
                    .foregroundColor(.indigo)
            }
            if !record.celebrant.isEmpty {
                Text(record.celebrant)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            HStack(spacing: 16) {
                Label("\(record.totalMale) Male", systemImage: "person.fill")
                    .font(.caption)
                    .foregroundColor(.blue)
                Label("\(record.totalFemale) Female", systemImage: "person.fill")
                    .font(.caption)
                    .foregroundColor(.pink)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Record Detail

struct RecordDetailView: View {
    let record: AttendanceRecord

    var body: some View {
        List {
            Section("Attendance") {
                LabeledContent("Date", value: record.date)
                LabeledContent("Male", value: "\(record.totalMale)")
                LabeledContent("Female", value: "\(record.totalFemale)")
                LabeledContent("Total", value: "\(record.total)")
            }

            if !record.celebrant.isEmpty || !record.parish.isEmpty || !record.scriptureReference.isEmpty {
                Section("Service") {
                    if !record.celebrant.isEmpty {
                        LabeledContent("Celebrant", value: record.celebrant)
                    }
                    if !record.parish.isEmpty {
                        LabeledContent("Parish", value: record.parish)
                    }
                    if !record.scriptureReference.isEmpty {
                        LabeledContent("Scripture", value: record.scriptureReference)
                    }
                }
            }

            if !record.rounds.isEmpty {
                Section("Rounds (\(record.rounds.count))") {
                    ForEach(Array(record.rounds.enumerated()), id: \.element.id) { index, round in
                        HStack {
                            Text("Round \(index + 1)")
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("\(round.male)M  \(round.female)F  = \(round.total)")
                                .font(.subheadline.monospacedDigit())
                        }
                    }
                }
            }

            if !record.notes.isEmpty {
                Section("Notes") {
                    Text(record.notes)
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle(record.date)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                ShareLink(item: record.shareText) {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
    }
}

// MARK: - Share text helper

extension AttendanceRecord {
    var shareText: String {
        var lines: [String] = ["MTC Attendance — \(date)"]
        if !celebrant.isEmpty { lines.append("Celebrant: \(celebrant)") }
        if !parish.isEmpty { lines.append("Parish: \(parish)") }
        if !scriptureReference.isEmpty { lines.append("Scripture: \(scriptureReference)") }
        lines.append("Male: \(totalMale)  Female: \(totalFemale)  Total: \(total)")
        if !notes.isEmpty { lines.append("Notes: \(notes)") }
        return lines.joined(separator: "\n")
    }
}
