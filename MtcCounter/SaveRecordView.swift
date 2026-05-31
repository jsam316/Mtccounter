import SwiftUI

struct SaveRecordView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var date = ""
    @State private var parish = ""
    @State private var celebrant = ""
    @State private var coCelebrantsEnabled = false
    @State private var coCelebrants = ""
    @State private var sermon = ""
    @State private var scriptureBook = ""
    @State private var scriptureChapter = 1
    @State private var verseFrom = ""
    @State private var verseTo = ""
    @State private var notes = ""

    @State private var selectedCoCelebrants: Set<String> = []
    @State private var showingManageCelebrants = false
    @State private var showingManageParishes = false
    @State private var showingCoCelebrantPicker = false

    var scriptureString: String {
        guard !scriptureBook.isEmpty else { return "" }
        var ref = "\(scriptureBook) \(scriptureChapter)"
        if !verseFrom.isEmpty {
            ref += ":\(verseFrom)"
            if !verseTo.isEmpty && verseTo != verseFrom {
                ref += "-\(verseTo)"
            }
        }
        return ref
    }

    var body: some View {
        NavigationStack {
            Form {
                // Service Details
                Section("Service Details") {
                    TextField("Date", text: $date)

                    // Parish Picker
                    if appState.parishes.isEmpty {
                        HStack {
                            TextField("Parish", text: $parish)
                            Button("Manage") { showingManageParishes = true }
                                .font(.caption)
                                .foregroundColor(.indigo)
                        }
                    } else {
                        HStack {
                            Picker("Parish", selection: $parish) {
                                Text("None").tag("")
                                ForEach(appState.parishes, id: \.self) { p in
                                    Text(p).tag(p)
                                }
                            }
                            Button { showingManageParishes = true } label: {
                                Image(systemName: "gear")
                                    .foregroundColor(.indigo)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    // Celebrant Picker
                    if appState.celebrants.isEmpty {
                        HStack {
                            TextField("Celebrant", text: $celebrant)
                            Button("Manage") { showingManageCelebrants = true }
                                .font(.caption)
                                .foregroundColor(.indigo)
                        }
                    } else {
                        HStack {
                            Picker("Celebrant", selection: $celebrant) {
                                Text("None").tag("")
                                ForEach(appState.celebrants, id: \.self) { c in
                                    Text(c).tag(c)
                                }
                            }
                            Button { showingManageCelebrants = true } label: {
                                Image(systemName: "gear")
                                    .foregroundColor(.indigo)
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    // Co-Celebrants Toggle
                    Toggle("Co-Celebrants", isOn: $coCelebrantsEnabled)
                        .tint(.indigo)
                    if coCelebrantsEnabled {
                        if appState.celebrants.isEmpty {
                            HStack {
                                TextField("Co-celebrant names (comma-separated)", text: $coCelebrants)
                                Button("Manage") { showingManageCelebrants = true }
                                    .font(.caption)
                                    .foregroundColor(.indigo)
                            }
                        } else {
                            HStack {
                                Button {
                                    showingCoCelebrantPicker = true
                                } label: {
                                    HStack {
                                        Text(selectedCoCelebrants.isEmpty
                                             ? "Select Co-Celebrants"
                                             : selectedCoCelebrants.sorted().joined(separator: ", "))
                                            .foregroundColor(selectedCoCelebrants.isEmpty ? .secondary : .primary)
                                            .multilineTextAlignment(.leading)
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .foregroundColor(.secondary)
                                            .font(.caption)
                                    }
                                }
                                .buttonStyle(.plain)
                                Button { showingManageCelebrants = true } label: {
                                    Image(systemName: "gear")
                                        .foregroundColor(.indigo)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                // Sermon & Scripture
                Section("Sermon & Scripture") {
                    TextField("Sermon Title", text: $sermon)

                    Picker("Book", selection: $scriptureBook) {
                        Text("Select Book").tag("")
                        ForEach(ScriptureData.bookNames, id: \.self) { book in
                            Text(book).tag(book)
                        }
                    }
                    .onChange(of: scriptureBook) { _ in
                        scriptureChapter = 1
                        verseFrom = ""
                        verseTo = ""
                    }

                    if !scriptureBook.isEmpty {
                        Stepper("Chapter: \(scriptureChapter)",
                                value: $scriptureChapter,
                                in: 1...ScriptureData.chapters(for: scriptureBook))
                            .onChange(of: scriptureChapter) { _ in
                                verseFrom = ""
                                verseTo = ""
                            }

                        HStack {
                            TextField("From verse", text: $verseFrom)
                                .keyboardType(.numberPad)
                            Text("–")
                                .foregroundColor(.secondary)
                            TextField("To verse", text: $verseTo)
                                .keyboardType(.numberPad)
                        }
                    }

                    if !scriptureString.isEmpty {
                        LabeledContent("Reference", value: scriptureString)
                            .foregroundColor(.indigo)
                    }
                }

                // Notes
                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }

                // Current Count Summary
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
                        let coValue: String = {
                            guard coCelebrantsEnabled else { return "" }
                            if appState.celebrants.isEmpty {
                                return coCelebrants
                            }
                            return selectedCoCelebrants.sorted().joined(separator: ", ")
                        }()
                        appState.saveRecord(
                            date: date,
                            parish: parish,
                            celebrant: celebrant,
                            coCelebrants: coValue,
                            sermon: sermon,
                            scripture: scriptureString.isEmpty ? "" : scriptureString,
                            notes: notes
                        )
                        dismiss()
                    }
                    .fontWeight(.bold)
                    .disabled(appState.grandTotal == 0)
                }
            }
            .sheet(isPresented: $showingManageCelebrants) {
                ManageListView(title: "Manage Celebrants",
                               items: appState.celebrants,
                               onAdd: { appState.addCelebrant($0) },
                               onDelete: { appState.deleteCelebrant($0) })
            }
            .sheet(isPresented: $showingCoCelebrantPicker) {
                CoCelebrantPickerView(celebrants: appState.celebrants,
                                      selected: $selectedCoCelebrants)
            }
            .sheet(isPresented: $showingManageParishes) {
                ManageListView(title: "Manage Parishes",
                               items: appState.parishes,
                               onAdd: { appState.addParish($0) },
                               onDelete: { appState.deleteParish($0) })
            }
        }
        .onAppear {
            let f = DateFormatter()
            f.dateStyle = .long
            date = f.string(from: Date())
        }
    }
}

// MARK: - Co-Celebrant multi-select sheet

struct CoCelebrantPickerView: View {
    @Environment(\.dismiss) private var dismiss
    let celebrants: [String]
    @Binding var selected: Set<String>

    var body: some View {
        NavigationStack {
            List(celebrants, id: \.self) { name in
                Button {
                    if selected.contains(name) {
                        selected.remove(name)
                    } else {
                        selected.insert(name)
                    }
                } label: {
                    HStack {
                        Text(name)
                            .foregroundColor(.primary)
                        Spacer()
                        if selected.contains(name) {
                            Image(systemName: "checkmark")
                                .foregroundColor(.indigo)
                        }
                    }
                }
            }
            .navigationTitle("Co-Celebrants")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.bold)
                }
            }
        }
    }
}

// MARK: - Reusable manage-list sheet

struct ManageListView: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let items: [String]
    let onAdd: (String) -> Void
    let onDelete: (String) -> Void

    @State private var newItem = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        TextField("Add new…", text: $newItem)
                        Button("Add") {
                            onAdd(newItem)
                            newItem = ""
                        }
                        .disabled(newItem.trimmingCharacters(in: .whitespaces).isEmpty)
                        .foregroundColor(.indigo)
                    }
                }

                if !items.isEmpty {
                    Section("Saved") {
                        ForEach(items, id: \.self) { item in
                            Text(item)
                        }
                        .onDelete { offsets in
                            offsets.forEach { onDelete(items[$0]) }
                        }
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.bold)
                }
            }
        }
    }
}
