import SwiftUI

struct SaveRecordView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var serviceDate = Date()
    @State private var service = ""
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

    // What the lectionary last filled in, so a date change can replace its
    // own suggestion but never something typed or picked by hand.
    @State private var lastThemeFill: String?
    @State private var lastScriptureFill: String?

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

    private var displayDate: String {
        let f = DateFormatter()
        f.dateStyle = .long
        return f.string(from: serviceDate)
    }

    private var lectionaryEntry: LectionaryEntry? { Lectionary.entry(for: serviceDate) }

    /// One-line lectionary suggestion for the chosen date, or a notice when
    /// that year's lectionary hasn't been added yet.
    private var lectionaryHint: (text: String, missing: Bool)? {
        if let e = lectionaryEntry {
            var parts: [String] = []
            if let o = e.occasion { parts.append(o) }
            if let t = e.theme { parts.append(e.weekly ? "Weekly theme: \(t)" : t) }
            var text = parts.joined(separator: " — ")
            if let g = e.gospel { text += (text.isEmpty ? "" : " · ") + "Gospel: \(g)" }
            return text.isEmpty ? nil : (text, false)
        }
        if !Lectionary.isYearLoaded(serviceDate) {
            let year = Calendar(identifier: .gregorian).component(.year, from: serviceDate)
            return ("The \(year) lectionary hasn't been added yet — sermon themes won't fill in automatically.", true)
        }
        return nil
    }

    // Picker/Stepper bindings that reset the dependent fields only when the
    // user changes them (not when the lectionary sets a whole reference).
    private var bookBinding: Binding<String> {
        Binding(get: { scriptureBook }, set: { newBook in
            scriptureBook = newBook
            scriptureChapter = 1
            verseFrom = ""
            verseTo = ""
        })
    }
    private var chapterBinding: Binding<Int> {
        Binding(get: { scriptureChapter }, set: { newChapter in
            scriptureChapter = newChapter
            verseFrom = ""
            verseTo = ""
        })
    }

    private func setScripture(_ ref: ScriptureRef?) {
        scriptureBook = ref?.book ?? ""
        scriptureChapter = ref?.chapter ?? 1
        verseFrom = ref?.verseFrom.map(String.init) ?? ""
        verseTo = ref?.verseTo.map(String.init) ?? ""
    }

    /// Fill the sermon title and reading from the lectionary when they are
    /// empty or still hold our earlier suggestion; `force` (tapping the hint)
    /// applies them regardless.
    private func applyLectionary(force: Bool = false) {
        let e = lectionaryEntry
        let themeIsOurs = lastThemeFill != nil && sermon == lastThemeFill
        if let theme = e?.theme {
            if force || sermon.trimmingCharacters(in: .whitespaces).isEmpty || themeIsOurs {
                sermon = theme
                lastThemeFill = theme
            }
        } else if themeIsOurs {
            sermon = ""
            lastThemeFill = nil
        }

        // Readings only from the day's own entry (not weekly Friday/Tuesday).
        let scriptureIsOurs = lastScriptureFill != nil && scriptureString == lastScriptureFill
        if let gospel = e?.gospel, let ref = ScriptureRef.parse(gospel) {
            if force || scriptureBook.isEmpty || scriptureIsOurs {
                setScripture(ref)
                lastScriptureFill = scriptureString
            }
        } else if scriptureIsOurs {
            setScripture(nil)
            lastScriptureFill = nil
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                // Service Details
                Section("Service Details") {
                    DatePicker("Date", selection: $serviceDate, displayedComponents: .date)
                        .onChange(of: serviceDate) { _ in applyLectionary() }

                    TextField("Service (optional) — e.g. Morning, Evening", text: $service)

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

                    if let hint = lectionaryHint {
                        if hint.missing {
                            Label(hint.text, systemImage: "exclamationmark.circle")
                                .font(.footnote)
                                .foregroundColor(.orange)
                        } else {
                            Button { applyLectionary(force: true) } label: {
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

                    if !scriptureBook.isEmpty {
                        Stepper("Chapter: \(scriptureChapter)",
                                value: chapterBinding,
                                in: 1...ScriptureData.chapters(for: scriptureBook))

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
                            date: displayDate,
                            isoDate: Lectionary.isoString(serviceDate),
                            service: service,
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
            // Start with the parish and celebrant used last time, if still listed.
            if parish.isEmpty, appState.parishes.contains(appState.lastParish) { parish = appState.lastParish }
            if celebrant.isEmpty, appState.celebrants.contains(appState.lastCelebrant) { celebrant = appState.lastCelebrant }
            applyLectionary()
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
