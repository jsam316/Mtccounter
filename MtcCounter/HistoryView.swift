import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var searchText = ""
    @State private var selectedRecordID: UUID?

    var filteredRecords: [AttendanceRecord] {
        guard !searchText.isEmpty else { return appState.records }
        return appState.records.filter {
            $0.celebrant.localizedCaseInsensitiveContains(searchText) ||
            $0.parish.localizedCaseInsensitiveContains(searchText) ||
            $0.date.localizedCaseInsensitiveContains(searchText) ||
            $0.scriptureReference.localizedCaseInsensitiveContains(searchText) ||
            $0.sermon.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        if horizontalSizeClass == .regular {
            NavigationSplitView {
                sidebarContent
                    .navigationTitle("History")
            } detail: {
                splitDetailContent
            }
        } else {
            NavigationStack {
                phoneListContent
                    .navigationTitle("History")
            }
        }
    }

    // MARK: - iPad sidebar list

    @ViewBuilder private var sidebarContent: some View {
        if appState.records.isEmpty {
            emptyState
        } else {
            List(selection: $selectedRecordID) {
                ForEach(filteredRecords) { record in
                    RecordRow(record: record)
                        .tag(record.id)
                }
                .onDelete { offsets in
                    let ids = offsets.map { filteredRecords[$0].id }
                    ids.forEach { appState.deleteRecord(id: $0) }
                }
            }
            .searchable(text: $searchText, prompt: "Search by date, celebrant, parish…")
        }
    }

    // MARK: - iPad detail pane

    @ViewBuilder private var splitDetailContent: some View {
        if let id = selectedRecordID,
           let record = appState.records.first(where: { $0.id == id }) {
            RecordDetailView(record: record)
        } else {
            VStack(spacing: 12) {
                Image(systemName: "clock")
                    .font(.system(size: 52))
                    .foregroundColor(.secondary)
                Text("Select a record")
                    .font(.title3)
                    .foregroundColor(.secondary)
                Text("Choose a record from the sidebar to view details.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding()
        }
    }

    // MARK: - iPhone list

    @ViewBuilder private var phoneListContent: some View {
        if appState.records.isEmpty {
            emptyState
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

    private var emptyState: some View {
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
            if !record.parish.isEmpty {
                Text(record.parish)
                    .font(.caption)
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

            if !record.celebrant.isEmpty || !record.parish.isEmpty ||
               !record.coCelebrants.isEmpty || !record.sermon.isEmpty ||
               !record.scriptureReference.isEmpty {
                Section("Service") {
                    if !record.parish.isEmpty {
                        LabeledContent("Parish", value: record.parish)
                    }
                    if !record.celebrant.isEmpty {
                        LabeledContent("Celebrant", value: record.celebrant)
                    }
                    if !record.coCelebrants.isEmpty {
                        LabeledContent("Co-Celebrants", value: record.coCelebrants)
                    }
                    if !record.sermon.isEmpty {
                        LabeledContent("Sermon", value: record.sermon)
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

            Section("Share") {
                Button(action: shareWhatsApp) {
                    Label("Share to WhatsApp", systemImage: "message.fill")
                        .foregroundColor(.green)
                }
                ShareLink(item: record.shareText) {
                    Label("Share as Text", systemImage: "square.and.arrow.up")
                        .foregroundColor(.indigo)
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

    private func shareWhatsApp() {
        let text = record.shareText
        if let encoded = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let url = URL(string: "https://wa.me/?text=\(encoded)") {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Share text helper

extension AttendanceRecord {
    var shareText: String {
        var lines: [String] = ["MTC Attendance — \(date)"]
        if !parish.isEmpty { lines.append("Parish: \(parish)") }
        if !celebrant.isEmpty { lines.append("Celebrant: \(celebrant)") }
        if !coCelebrants.isEmpty { lines.append("Co-Celebrants: \(coCelebrants)") }
        if !sermon.isEmpty { lines.append("Sermon: \(sermon)") }
        if !scriptureReference.isEmpty { lines.append("Scripture: \(scriptureReference)") }
        lines.append("Male: \(totalMale)  Female: \(totalFemale)  Total: \(total)")
        if !rounds.isEmpty {
            lines.append("Rounds: \(rounds.count)")
        }
        if !notes.isEmpty { lines.append("Notes: \(notes)") }
        return lines.joined(separator: "\n")
    }
}
