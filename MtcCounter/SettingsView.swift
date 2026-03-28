import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingClearConfirm = false
    @State private var showingExportSheet = false
    @State private var exportItems: [Any] = []

    var body: some View {
        NavigationView {
            Form {
                Section("Statistics") {
                    LabeledContent("Total Records", value: "\(appState.records.count)")
                    if !appState.records.isEmpty {
                        let totalAttendees = appState.records.reduce(0) { $0 + $1.total }
                        LabeledContent("Total Attendees", value: "\(totalAttendees)")
                        let avg = totalAttendees / appState.records.count
                        LabeledContent("Average Attendance", value: "\(avg)")
                    }
                }

                Section("Export") {
                    Button(action: exportCSV) {
                        Label("Export as CSV", systemImage: "square.and.arrow.up")
                    }
                    .disabled(appState.records.isEmpty)
                }

                Section("Data Management") {
                    Button(role: .destructive, action: { showingClearConfirm = true }) {
                        Label("Clear All Records", systemImage: "trash")
                    }
                    .disabled(appState.records.isEmpty)
                }

                Section("About") {
                    LabeledContent("App", value: "MTC Counter")
                    LabeledContent("Version", value: "1.0")
                    LabeledContent("Platform", value: "iOS + watchOS")
                    Text("MarThoma Church attendance tracking app for counting service attendees.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog(
                "Clear all records?",
                isPresented: $showingClearConfirm,
                titleVisibility: .visible
            ) {
                Button("Clear All Records", role: .destructive) {
                    appState.records.removeAll()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will permanently delete all \(appState.records.count) saved attendance records.")
            }
            .sheet(isPresented: $showingExportSheet) {
                ActivityView(activityItems: exportItems)
            }
        }
    }

    private func exportCSV() {
        var csv = "Date,Celebrant,Parish,Scripture,Male,Female,Total,Rounds,Notes\n"
        for record in appState.records {
            let row = [
                record.date,
                record.celebrant,
                record.parish,
                record.scriptureReference,
                "\(record.totalMale)",
                "\(record.totalFemale)",
                "\(record.total)",
                "\(record.rounds.count)",
                record.notes
            ]
            .map { "\"\($0.replacingOccurrences(of: "\"", with: "\"\""))\"" }
            .joined(separator: ",")
            csv += row + "\n"
        }
        exportItems = [csv]
        showingExportSheet = true
    }
}

// MARK: - UIActivityViewController wrapper

struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
