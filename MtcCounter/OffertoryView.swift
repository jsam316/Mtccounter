import SwiftUI

/// The offertory counting sheet for the service in progress, laid out like
/// the church's paper form: pick a column, then enter how many of each note
/// or coin were counted. Amounts, totals and the amount in words follow.
struct OffertoryView: View {
    @EnvironmentObject var appState: AppState

    /// Column on screen: one of the counted columns' raw value, or "total".
    @State private var selected = OffertoryColumn.offertory.rawValue
    @State private var shareItems: [Any] = []
    @State private var showingShare = false
    @State private var pendingCurrency: String?

    private var sheet: Offertory { appState.offertory }
    private var info: OffertoryCurrency { sheet.currencyInfo }
    private var signed: Bool { sheet.isSigned }
    private var selectedColumn: OffertoryColumn? { OffertoryColumn(rawValue: selected) }

    private struct Tab: Identifiable {
        let id: String
        let title: String
    }

    private var tabs: [Tab] {
        OffertoryColumn.allCases.map { Tab(id: $0.rawValue, title: sheet.title(of: $0)) } + [Tab(id: "total", title: "Total")]
    }

    var body: some View {
        NavigationStack {
            Form {
                headingSection
                columnPickerSection
                rowsSection
                totalsSection
                signatureSection
                exportSection
            }
            .navigationTitle("Offertory")
            .sheet(isPresented: $showingShare) {
                ActivityView(activityItems: shareItems)
            }
            .confirmationDialog(
                "Change currency?",
                isPresented: Binding(get: { pendingCurrency != nil }, set: { if !$0 { pendingCurrency = nil } }),
                titleVisibility: .visible
            ) {
                Button("Change and drop those counts", role: .destructive) {
                    if let code = pendingCurrency { appState.setOffertoryCurrency(code) }
                    pendingCurrency = nil
                }
                Button("Cancel", role: .cancel) { pendingCurrency = nil }
            } message: {
                Text("Some notes or coins you counted don't exist in the new currency. Their counts will be removed.")
            }
        }
    }

    // MARK: - Heading: currency, venue, special name, date

    private var currencyBinding: Binding<String> {
        Binding(get: { sheet.currency }, set: { code in
            guard code != sheet.currency else { return }
            if sheet.losesCounts(changingTo: code) { pendingCurrency = code } else { appState.setOffertoryCurrency(code) }
        })
    }

    private var headingSection: some View {
        Section {
            Picker("Currency", selection: currencyBinding) {
                ForEach(OffertoryData.currencies, id: \.code) { c in
                    Text("\(c.code) – \(c.name)").tag(c.code)
                }
            }
            TextField("Venue (e.g. Hall of Peace)", text: $appState.offertory.venue)
            TextField("Special column name (e.g. Harvest Festival)", text: $appState.offertory.specialLabel)
            LabeledContent("Service", value: appState.details.recap)
        } header: {
            Text("Sheet")
        } footer: {
            if signed {
                Label("Signed. Clear the signatures to change the counts.", systemImage: "lock.fill")
                    .foregroundColor(.orange)
            } else {
                Text("The date and church name on the sheet come from Service details on the Counter tab.")
            }
        }
        .disabled(signed)
    }

    // MARK: - Column picker (the form's columns as chips)

    private var columnPickerSection: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(tabs) { tab in
                        Button(action: { selected = tab.id }) {
                            Text(tab.title)
                                .font(.subheadline.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(selected == tab.id ? Color.indigo : Color.secondary.opacity(0.15))
                                .foregroundColor(selected == tab.id ? Color.white : Color.primary)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    // MARK: - One row per note or coin

    private func unitsBinding(_ column: OffertoryColumn, _ label: String) -> Binding<String> {
        Binding(get: {
            let n = sheet.units(column, label)
            return n == 0 ? "" : String(n)
        }, set: { text in
            let digits = String(text.filter { $0.isASCII && $0.isNumber }.prefix(5))
            appState.offertory.setUnits(Int(digits) ?? 0, column, label)
        })
    }

    private var rowsSection: some View {
        let column = selectedColumn
        let columnTitle = column.map { sheet.title(of: $0) } ?? "Total"
        let columnTotal = column.map { sheet.total(of: $0) } ?? sheet.totalMinor
        return Section {
            ForEach(info.denominations, id: \.self) { label in
                let units = column.map { sheet.units($0, label) } ?? sheet.totalUnits(label)
                HStack(spacing: 10) {
                    Text(label)
                        .font(.body.weight(.semibold))
                        .frame(width: 64, alignment: .leading)
                    Text("×")
                        .foregroundColor(.secondary)
                    if let column = column {
                        TextField("0", text: unitsBinding(column, label))
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.center)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 76)
                            .disabled(signed)
                            .accessibilityLabel("\(label) units")
                    } else {
                        Text(units == 0 ? "–" : "\(units)")
                            .font(.body.weight(.semibold))
                            .frame(width: 76)
                    }
                    Spacer(minLength: 4)
                    Text(units == 0 ? "–" : OffertoryMoney.format(units * info.minorUnits(of: label), info))
                        .monospacedDigit()
                        .foregroundColor(units == 0 ? Color.secondary : Color.primary)
                }
            }
            HStack {
                Text("\(columnTitle) \(info.code)").fontWeight(.bold)
                Spacer()
                Text(OffertoryMoney.format(columnTotal, info)).fontWeight(.bold).monospacedDigit()
            }
        } header: {
            HStack {
                Text("Note / coin")
                Spacer()
                Text("Unit")
                Spacer()
                Text(info.code)
            }
        }
    }

    // MARK: - Totals and amount in words

    private var totalsSection: some View {
        Section("Totals") {
            ForEach(OffertoryColumn.allCases, id: \.rawValue) { column in
                HStack {
                    Text(sheet.title(of: column))
                    Spacer()
                    Text(OffertoryMoney.format(sheet.total(of: column), info))
                        .monospacedDigit()
                        .foregroundColor(.secondary)
                }
            }
            HStack {
                Text("Total \(info.code)").fontWeight(.bold)
                Spacer()
                Text(OffertoryMoney.format(sheet.totalMinor, info)).fontWeight(.bold).monospacedDigit()
            }
            if !sheet.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Amount in words").font(.caption).foregroundColor(.secondary)
                    Text(OffertoryMoney.inWords(sheet.totalMinor, info)).font(.subheadline)
                }
            }
        }
    }

    // MARK: - Signatures

    private var signatureSection: some View {
        Section {
            ForEach(0..<2, id: \.self) { index in
                signatureBox(index)
            }
        } header: {
            Text("Signatures")
        } footer: {
            Text(sheet.isEmpty
                 ? "Count the offertory first, then sign."
                 : "Sign with a finger. Once signed, the counts are locked until the signatures are cleared.")
        }
    }

    private func inkColor(_ key: String) -> Color {
        let ink = OffertorySignature.ink(key)
        return Color(red: Double(ink.red) / 255, green: Double(ink.green) / 255, blue: Double(ink.blue) / 255)
    }

    private func signatureBox(_ index: Int) -> some View {
        let signature = sheet.signatures.indices.contains(index) ? sheet.signatures[index] : OffertorySignature()
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Text("Signature (\(index + 1))").font(.subheadline.weight(.semibold))
                Spacer()
                ForEach(OffertorySignature.inks, id: \.key) { ink in
                    Button(action: { setInk(index, ink.key) }) {
                        Circle()
                            .fill(inkColor(ink.key))
                            .frame(width: 24, height: 24)
                            .overlay(Circle().stroke(Color.indigo, lineWidth: signature.color == ink.key ? 3 : 0).padding(-3))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(ink.title) pen")
                }
                if signature.isSigned {
                    Button("Clear", role: .destructive) { clearSignature(index) }
                        .buttonStyle(.borderless)
                        .font(.subheadline)
                }
            }
            SignaturePad(strokes: signature.strokes, color: inkColor(signature.color), enabled: !sheet.isEmpty) { stroke in
                addStroke(index, stroke)
            }
            TextField("Name (optional)", text: nameBinding(index))
                .textFieldStyle(.roundedBorder)
        }
        .padding(.vertical, 4)
    }

    private func nameBinding(_ index: Int) -> Binding<String> {
        Binding(get: {
            sheet.signatures.indices.contains(index) ? sheet.signatures[index].name : ""
        }, set: { name in
            guard appState.offertory.signatures.indices.contains(index) else { return }
            appState.offertory.signatures[index].name = String(name.prefix(60))
        })
    }

    private func setInk(_ index: Int, _ key: String) {
        guard appState.offertory.signatures.indices.contains(index), OffertorySignature.isInk(key) else { return }
        appState.offertory.signatures[index].color = key
    }

    private func addStroke(_ index: Int, _ stroke: [Int]) {
        guard !appState.offertory.isEmpty,
              appState.offertory.signatures.indices.contains(index),
              appState.offertory.signatures[index].strokes.count < OffertorySignature.maxStrokes,
              stroke.count >= 2 else { return }
        appState.offertory.signatures[index].strokes.append(stroke)
    }

    private func clearSignature(_ index: Int) {
        guard appState.offertory.signatures.indices.contains(index) else { return }
        appState.offertory.signatures[index].strokes = []
    }

    // MARK: - PDF

    private var exportSection: some View {
        Section {
            Button(action: exportPDF) {
                Label("Offertory PDF", systemImage: "doc.richtext")
            }
            .disabled(sheet.isEmpty)
        } footer: {
            Text("The sheet is saved with the service when you save the record on the Counter tab.")
        }
    }

    private func exportPDF() {
        let iso = appState.details.isoDate
        let report = sheet.report(parish: appState.offertoryChurchName, isoDate: iso)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("MTC_Offertory_\(iso).pdf")
        do {
            try OffertoryPDF.data(for: report).write(to: url, options: .atomic)
            shareItems = [url]
            showingShare = true
        } catch {
            // Sharing the data itself still works if the file can't be written.
            shareItems = [OffertoryPDF.data(for: report)]
            showingShare = true
        }
    }
}

// MARK: - Signature pad

/// A white box to sign in. Strokes are reported in the signature's own grid
/// (0…1000 each way), so they look the same at any size and in the PDF.
struct SignaturePad: View {
    let strokes: [[Int]]
    let color: Color
    let enabled: Bool
    let onStroke: ([Int]) -> Void

    @State private var current: [Int] = []

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                Color.white
                SignatureShape(strokes: current.isEmpty ? strokes : strokes + [current])
                    .stroke(color, style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
                if strokes.isEmpty && current.isEmpty {
                    Text("Sign here")
                        .font(.caption)
                        .foregroundColor(.gray)
                        .padding(.bottom, 6)
                }
            }
            .contentShape(Rectangle())
            .highPriorityGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        guard enabled, geo.size.width > 0, geo.size.height > 0 else { return }
                        let x = SignaturePad.grid(value.location.x / geo.size.width)
                        let y = SignaturePad.grid(value.location.y / geo.size.height)
                        let n = current.count
                        // Skip tiny movements so a signature stays a few hundred numbers.
                        if n >= 2 && abs(x - current[n - 2]) < 3 && abs(y - current[n - 1]) < 6 { return }
                        if n < OffertorySignature.maxStrokeNumbers { current.append(contentsOf: [x, y]) }
                    }
                    .onEnded { _ in
                        if current.count >= 2 { onStroke(current) }
                        current = []
                    }
            )
        }
        .aspectRatio(CGFloat(OffertorySignature.aspect), contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.secondary.opacity(0.4), lineWidth: 1))
        .opacity(enabled ? 1 : 0.55)
        .accessibilityLabel("Signature box")
    }

    private static func grid(_ fraction: CGFloat) -> Int {
        let scaled = (fraction * CGFloat(OffertorySignature.grid)).rounded()
        return Int(min(CGFloat(OffertorySignature.grid), max(0, scaled)))
    }
}

/// The strokes of a signature as one path.
struct SignatureShape: Shape {
    let strokes: [[Int]]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let grid = CGFloat(OffertorySignature.grid)
        for stroke in strokes where stroke.count >= 2 {
            func point(_ i: Int) -> CGPoint {
                CGPoint(x: rect.minX + CGFloat(stroke[i]) / grid * rect.width,
                        y: rect.minY + CGFloat(stroke[i + 1]) / grid * rect.height)
            }
            let start = point(0)
            path.move(to: start)
            if stroke.count == 2 {
                // A tap: a very short line, which the round cap shows as a dot.
                path.addLine(to: CGPoint(x: start.x + 0.1, y: start.y))
                continue
            }
            var i = 2
            while i + 1 < stroke.count {
                path.addLine(to: point(i))
                i += 2
            }
        }
        return path
    }
}
