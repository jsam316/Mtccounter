import SwiftUI

struct SaveRecordView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var date = ""
    @State private var celebrant = ""
    @State private var parish = ""
    @State private var scriptureReference = ""
    @State private var notes = ""

    var body: some View {
        NavigationView {
            Form {
                Section("Service Details") {
                    TextField("Date", text: $date)
                    TextField("Celebrant", text: $celebrant)
                    TextField("Parish", text: $parish)
                    TextField("Scripture Reference (e.g. John 3:16)", text: $scriptureReference)
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }

                Section("Current Count") {
                    HStack {
                        Text("Male")
                        Spacer()
                        Text("\(appState.grandMale)")
                            .foregroundColor(.blue)
                            .fontWeight(.semibold)
                    }
                    HStack {
                        Text("Female")
                        Spacer()
                        Text("\(appState.grandFemale)")
                            .foregroundColor(.pink)
                            .fontWeight(.semibold)
                    }
                    HStack {
                        Text("Total")
                            .fontWeight(.bold)
                        Spacer()
                        Text("\(appState.grandTotal)")
                            .foregroundColor(.indigo)
                            .fontWeight(.bold)
                    }
                }
            }
            .navigationTitle("Save Record")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        appState.saveRecord(
                            date: date,
                            celebrant: celebrant,
                            parish: parish,
                            scripture: scriptureReference,
                            notes: notes
                        )
                        dismiss()
                    }
                    .fontWeight(.bold)
                }
            }
        }
        .onAppear {
            let f = DateFormatter()
            f.dateStyle = .long
            date = f.string(from: Date())
        }
    }
}
