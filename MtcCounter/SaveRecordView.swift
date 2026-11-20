import SwiftUI

/// Service details: date, parish, celebrant, sermon and reading. Opened from
/// the top of the Counter tab and filled in before counting starts; the
/// details are kept as they are typed and stored with the record on Save.
struct ServiceDetailsView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var showingManageCelebrants = false
    @State private var showingManageParishes = false
    @State private var showingCoCelebrantPicker = false

    private var details: ServiceDetails { appState.details }

    /// One-line lectionary suggestion for the chosen date, or a notice when
    /// that year's lectionary hasn't been added yet.
    private var lectionaryHint: (text: String, missing: Bool)? {
        if let e = details.lectionaryEntry {
            var parts: [String] = []
            if let o = e.occasion { parts.append(o) }
            if let t = e.theme { parts.append(e.weekly ? "Weekly theme: \(t)" : t) }
            var text = parts.joined(separator: " — ")
            if let g = e.gospel { text += (text.isEmpty ? "" : " · ") + "Gospel: \(g)" }
            return text.isEmpty ? nil : (text, false)
        }
        if !Lectionary.isYearLoaded(details.serviceDate) {
            let year = Calendar(identifier: .gregorian).component(.year, from: details.serviceDate)
            return ("The \(year) lectionary hasn't been added yet — sermon themes won't fill in automatically.", true)
        }
        return nil
    }

    // Picker/Stepper bindings that reset the dependent fields only when the
    // user changes them (not when the lectionary sets a whole reference).
    private var bookBinding: Binding<String> {
        Binding(get: { appState.details.scriptureBook }, set: { newBook in
            var d = appState.details
            d.scriptureBook = newBook
            d.scriptureChapter = 1
            d.verseFrom = ""
            d.verseTo = ""
            appState.details = d
        })
    }
    private var chapterBinding: Binding<Int> {
        Binding(get: { appState.details.scriptureChapter }, set: { newChapter in
            var d = appState.details
            d.scriptureChapter = newChapter
            d.verseFrom = ""
            d.verseTo = ""
            appState.details = d
        })
    }
    private var coCelebrantSelection: Binding<Set<String>> {
        Binding(get: { Set(appState.details.selectedCoCelebrants) },
                set: { appState.details.selectedCoCelebrants = $0.sorted() })
    }

    var body: some View {
        NavigationStack {
            Form {
                // Service Details
                Section("Service Details") {
                    DatePicker("Date", selection: $appState.details.serviceDate, displayedComponents: .date)
                        .onChange(of: appState.details.serviceDate) { _ in appState.details.applyLectionary() }

                    TextField("Service (optional) — e.g. Morning, Evening", text: $appState.details.service)

                    // Parish Picker
                    if appState.parishes.isEmpty {
                        HStack {
                            TextField("Parish", text: $appState.details.parish)
                            Button("Manage") { showingManageParishes = true }
                                .font(.caption)
                                .foregroundColor(.indigo)
                        }
                    } else {
                        HStack {
                            Picker("Parish", selection: $appState.details.parish) {
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
                            TextField("Celebrant", text: $appState.details.celebrant)
                            Button("Manage") { showingManageCelebrants = true }
                                .font(.caption)
                                .foregroundColor(.indigo)
                        }
                    } else {
                        HStack {
                            Picker("Celebrant", selection: $appState.details.celebrant) {
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
                    Toggle("Co-Celebrants", isOn: $appState.details.coCelebrantsEnabled)
                        .tint(.indigo)
                    if details.coCelebrantsEnabled {
                        if appState.celebrants.isEmpty {
                            HStack {
                                TextField("Co-celebrant names (comma-separated)", text: $appState.details.coCelebrantsText)
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
                                        Text(details.selectedCoCelebrants.isEmpty
                                             ? "Select Co-Celebrants"
                                             : details.selectedCoCelebrants.sorted().joined(separator: ", "))
                                            .foregroundColor(details.selectedCoCelebrants.isEmpty ? Color.secondary : Color.primary)
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
                    TextField("Sermon Title", text: $appState.details.sermon)

                    if let hint = lectionaryHint {
                        if hint.missing {
                            Label(hint.text, systemImage: "exclamationmark.circle")
                                .font(.footnote)
                                .foregroundColor(.orange)
                        } else {
                            Button { appState.details.applyLectionary(force: true) } label: {
                                Label(hint.text, systemImage: "book")
                                    .font(.footnote)
                                    .foregroundColor(.indigo)
                                    .multilineTextAlignment(.leading)
                            }
                            .accessibilityHint("Use as the sermon title and reading")
                        }
                    }

                    Picker("Book", selection: bookBinding) {
                        Text("Select Book").tag("")
                        ForEach(ScriptureData.bookNames, id: \.self) { book in
                            Text(book).tag(book)
                        }
                    }

                    if !details.scriptureBook.isEmpty {
                        Stepper("Chapter: \(details.scriptureChapter)",
                                value: chapterBinding,
                                in: 1...max(1, ScriptureData.chapters(for: details.scriptureBook)))

                        HStack {
                            TextField("From verse", text: $appState.details.verseFrom)
                                .keyboardType(.numberPad)
                            Text("–")
                                .foregroundColor(.secondary)
                            TextField("To verse", text: $appState.details.verseTo)
                                .keyboardType(.numberPad)
                        }
                    }

                    if !details.scriptureString.isEmpty {
                        LabeledContent("Reference", value: details.scriptureString)
                            .foregroundColor(.indigo)
                    }
                }

                // Notes
                Section("Notes") {
                    TextEditor(text: $appState.details.notes)
                        .frame(minHeight: 80)
                }

                Section {
                    EmptyView()
                } footer: {
                    Text("These details are kept as you type. They are saved with the count and the offertory when you tap Save Record on the Counter tab.")
                }
            }
            .navigationTitle("Service Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.bold)
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
                                      selected: coCelebrantSelection)
            }
            .sheet(isPresented: $showingManageParishes) {
                ManageListView(title: "Manage Parishes",
                               items: appState.parishes,
                               onAdd: { appState.addParish($0) },
                               onDelete: { appState.deleteParish($0) })
            }
        }
        .onAppear { appState.prepareDetails() }
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
