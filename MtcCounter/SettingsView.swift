import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingClearConfirm = false
    @State private var showingExportSheet = false
    @State private var exportItems: [Any] = []
    @State private var showingManageCelebrants = false
    @State private var showingManageParishes = false

    private var totalAttendees: Int {
        appState.records.reduce(0) { $0 + $1.total }
    }
    private var avgAttendance: Int {
        appState.records.isEmpty ? 0 : totalAttendees / appState.records.count
    }
    private var highestRecord: AttendanceRecord? {
        appState.records.max(by: { $0.total < $1.total })
    }
    private var totalMale: Int { appState.records.reduce(0) { $0 + $1.totalMale } }
    private var totalFemale: Int { appState.records.reduce(0) { $0 + $1.totalFemale } }

    var body: some View {
        NavigationView {
            Form {
                // MARK: Statistics
                Section("Statistics") {
                    LabeledContent("Total Services", value: "\(appState.records.count)")
                    if !appState.records.isEmpty {
                        LabeledContent("Total Attendees", value: "\(totalAttendees)")
                        LabeledContent("Average Attendance", value: "\(avgAttendance)")
                        LabeledContent("Total Male", value: "\(totalMale)")
                        LabeledContent("Total Female", value: "\(totalFemale)")
                        if let high = highestRecord {
                            LabeledContent("Highest Service", value: "\(high.total) on \(high.date)")
                        }
                    }
                }

                // MARK: Manage People & Parishes
                Section("Manage") {
                    Button(action: { showingManageCelebrants = true }) {
                        Label("Manage Celebrants (\(appState.celebrants.count))",
                              systemImage: "person.badge.plus")
                    }
                    .foregroundColor(.primary)

                    Button(action: { showingManageParishes = true }) {
                        Label("Manage Parishes (\(appState.parishes.count))",
                              systemImage: "building.2")
                    }
                    .foregroundColor(.primary)
                }

                // MARK: Export
                Section("Export") {
                    Button(action: exportCSV) {
                        Label("Export as CSV", systemImage: "tablecells")
                    }
                    .disabled(appState.records.isEmpty)

                    Button(action: exportPDF) {
                        Label("Export as PDF", systemImage: "doc.richtext")
                    }
                    .disabled(appState.records.isEmpty)
                }

                // MARK: Data Management
                Section("Data Management") {
                    Button(role: .destructive, action: { showingClearConfirm = true }) {
                        Label("Clear All Records", systemImage: "trash")
                    }
                    .disabled(appState.records.isEmpty)
                }

                // MARK: About
                Section("About") {
                    LabeledContent("App", value: "MTC Counter")
                    LabeledContent("Version", value: "2.0")
                    LabeledContent("Platform", value: "iOS + watchOS + Web")
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
            .sheet(isPresented: $showingManageCelebrants) {
                ManageListView(title: "Manage Celebrants",
                               items: appState.celebrants,
                               onAdd: { appState.addCelebrant($0) },
                               onDelete: { appState.deleteCelebrant($0) })
            }
            .sheet(isPresented: $showingManageParishes) {
                ManageListView(title: "Manage Parishes",
                               items: appState.parishes,
                               onAdd: { appState.addParish($0) },
                               onDelete: { appState.deleteParish($0) })
            }
        }
    }

    // MARK: - CSV Export

    private func exportCSV() {
        exportItems = [appState.exportCSV()]
        showingExportSheet = true
    }

    // MARK: - PDF Export

    private func exportPDF() {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 595, height: 842))
        let data = renderer.pdfData { ctx in
            ctx.beginPage()
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.boldSystemFont(ofSize: 18),
                .foregroundColor: UIColor.label
            ]
            let subAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 12),
                .foregroundColor: UIColor.secondaryLabel
            ]
            var y: CGFloat = 40
            let left: CGFloat = 40

            "MTC Counter — Attendance Export".draw(at: CGPoint(x: left, y: y), withAttributes: attrs)
            y += 30

            for record in appState.records {
                if y > 780 {
                    ctx.beginPage()
                    y = 40
                }
                let line = "\(record.date)  |  M:\(record.totalMale)  F:\(record.totalFemale)  T:\(record.total)"
                line.draw(at: CGPoint(x: left, y: y), withAttributes: subAttrs)
                y += 18
                if !record.celebrant.isEmpty {
                    "  Celebrant: \(record.celebrant)".draw(at: CGPoint(x: left + 16, y: y), withAttributes: subAttrs)
                    y += 16
                }
            }
        }
        exportItems = [data]
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
