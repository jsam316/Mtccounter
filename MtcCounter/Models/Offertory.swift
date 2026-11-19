import Foundation

// Offertory counting sheet, laid out like the church's paper form: one row
// per note or coin and, for each column (Offertory, Birthday, Wedding,
// Special, Family Day, Upakoshanam), the number of units counted. Amounts,
// column totals, the Total column and the amount in words are worked out
// from the counts.
//
// Same rules and the same stored JSON as the web app (src/offertory.js), so
// a sheet moves between the two through a backup. All money maths is done in
// whole minor units (fils, paise, cents) so totals are exact.
//
// Foundation only: the tests in tools/swift-tests compile this file as is.

// MARK: - Currency

struct OffertoryCurrency: Equatable {
    let code: String
    let name: String
    let plural: String
    let minorName: String
    /// Decimal places: 2 for most, 3 for KWD/BHD/OMR.
    let decimals: Int
    /// Notes and coins as printed, largest first ("20", "0.500").
    let denominations: [String]

    /// Minor units in one major unit (1000 fils in a dinar).
    var factor: Int {
        var f = 1
        for _ in 0..<decimals { f *= 10 }
        return f
    }

    /// Value of a note or coin in minor units: "0.500" KWD is 500.
    func minorUnits(of label: String) -> Int {
        let parts = label.split(separator: ".", maxSplits: 1).map(String.init)
        let whole = Int(parts.first ?? "") ?? 0
        guard parts.count > 1 else { return whole * factor }
        let digits = String((parts[1] + String(repeating: "0", count: decimals)).prefix(decimals))
        return whole * factor + (Int(digits) ?? 0)
    }

    static func find(_ code: String) -> OffertoryCurrency? {
        OffertoryData.currencies.first { $0.code == code }
    }

    static var fallback: OffertoryCurrency { find("KWD") ?? OffertoryData.currencies[0] }
}

// MARK: - Columns

enum OffertoryColumn: String, CaseIterable {
    case offertory, birthday, wedding, special, familyDay, upakoshanam

    var title: String {
        switch self {
        case .offertory: return "Offertory"
        case .birthday: return "Birthday"
        case .wedding: return "Wedding"
        case .special: return "Special"
        case .familyDay: return "Family Day"
        case .upakoshanam: return "Upakoshanam"
        }
    }

    /// The paper form has the first four; these two are printed only when used.
    var isExtra: Bool { self == .familyDay || self == .upakoshanam }
}

// MARK: - Signature

/// A pen colour: its stored name and red/green/blue from 0 to 255.
struct OffertoryInk: Equatable {
    let key: String
    let title: String
    let red: Int
    let green: Int
    let blue: Int
}

/// A signature is the pen strokes drawn on screen, not a picture: each stroke
/// is a flat list x1,y1,x2,y2,… of whole numbers from 0 to `grid` across a box
/// `aspect` times as wide as it is tall.
struct OffertorySignature: Codable, Equatable {
    var name: String = ""
    var strokes: [[Int]] = []
    var color: String = "black"

    static let grid = 1000
    static let aspect = 3
    static let maxStrokes = 150
    static let maxStrokeNumbers = 4000

    /// Pen colours a signer can pick (the same three as the web app).
    static let inks: [OffertoryInk] = [
        OffertoryInk(key: "black", title: "Black", red: 17, green: 24, blue: 39),
        OffertoryInk(key: "blue", title: "Blue", red: 29, green: 78, blue: 216),
        OffertoryInk(key: "navy", title: "Dark blue", red: 30, green: 58, blue: 138),
    ]

    /// The ink for a stored colour name; black for anything unknown.
    static func ink(_ key: String) -> OffertoryInk { inks.first { $0.key == key } ?? inks[0] }

    static func isInk(_ key: String) -> Bool { inks.contains { $0.key == key } }

    var isSigned: Bool { !strokes.isEmpty }

    enum CodingKeys: String, CodingKey { case name, strokes, color }

    init(name: String = "", strokes: [[Int]] = [], color: String = "black") {
        self.name = name
        self.strokes = strokes
        self.color = color
        normalize()
    }

    /// Lenient: anything unexpected is dropped or clamped, never trusted.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        color = (try? c.decode(String.self, forKey: .color)) ?? "black"
        let raw = (try? c.decode([[LenientInt]].self, forKey: .strokes)) ?? []
        strokes = raw.map { $0.map { $0.value } }
        normalize()
    }

    mutating func normalize() {
        name = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(60))
        if !OffertorySignature.isInk(color) { color = "black" }
        var clean: [[Int]] = []
        for stroke in strokes {
            var points: [Int] = Array(stroke.prefix(OffertorySignature.maxStrokeNumbers))
            if points.count % 2 == 1 { points.removeLast() }                  // whole x,y pairs only
            guard points.count >= 2 else { continue }
            clean.append(points.map { min(OffertorySignature.grid, max(0, $0)) })
            if clean.count == OffertorySignature.maxStrokes { break }
        }
        strokes = clean
    }
}

/// A whole number that may have been stored as a number or as text.
struct LenientInt: Decodable {
    let value: Int
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let v = try? c.decode(Int.self) { value = v }
        else if let v = try? c.decode(Double.self), v.isFinite, abs(v) < 1e15 { value = Int(v.rounded()) }
        else if let s = try? c.decode(String.self), let v = Int(s.trimmingCharacters(in: .whitespaces)) { value = v }
        else { value = 0 }
    }
}

// MARK: - Sheet

struct Offertory: Codable, Equatable {
    static let maxUnits = 99999

    var currency: String
    var venue: String
    var specialLabel: String
    /// column → note or coin → units counted. Only counts above zero are kept.
    var counts: [String: [String: Int]]
    var signatures: [OffertorySignature]

    static func empty(currency: String = OffertoryCurrency.fallback.code, venue: String = "") -> Offertory {
        Offertory(currency: currency, venue: venue, specialLabel: "", counts: [:], signatures: [])
    }

    init(currency: String, venue: String, specialLabel: String,
         counts: [String: [String: Int]], signatures: [OffertorySignature]) {
        self.currency = currency
        self.venue = venue
        self.specialLabel = specialLabel
        self.counts = counts
        self.signatures = signatures
        normalize()
    }

    var currencyInfo: OffertoryCurrency { OffertoryCurrency.find(currency) ?? OffertoryCurrency.fallback }

    // MARK: Codable (the web app's JSON)

    enum CodingKeys: String, CodingKey {
        case currency, venue, specialLabel, counts, signatures, totalMinor, total
    }

    /// Lenient: a backup can be edited by hand, so nothing in it is trusted.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        currency = (try? c.decode(String.self, forKey: .currency)) ?? ""
        venue = (try? c.decode(String.self, forKey: .venue)) ?? ""
        specialLabel = (try? c.decode(String.self, forKey: .specialLabel)) ?? ""
        let raw = (try? c.decode([String: [String: LenientInt]].self, forKey: .counts)) ?? [:]
        counts = raw.mapValues { $0.mapValues { $0.value } }
        signatures = (try? c.decode([OffertorySignature].self, forKey: .signatures)) ?? []
        normalize()
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(currency, forKey: .currency)
        try c.encode(venue, forKey: .venue)
        try c.encode(specialLabel, forKey: .specialLabel)
        var all: [String: [String: Int]] = [:]
        for col in OffertoryColumn.allCases { all[col.rawValue] = counts[col.rawValue] ?? [:] }
        try c.encode(all, forKey: .counts)
        try c.encode(signatures, forKey: .signatures)
        // Totals are written for the web app's benefit; they are always
        // worked out again from the counts when read.
        let total = totalMinor
        try c.encode(total, forKey: .totalMinor)
        try c.encode(Double(total) / Double(currencyInfo.factor), forKey: .total)
    }

    /// Make the sheet safe and tidy: a known currency, known columns and
    /// notes/coins only, whole counts within range, exactly two signatures.
    mutating func normalize() {
        if OffertoryCurrency.find(currency) == nil { currency = OffertoryCurrency.fallback.code }
        venue = String(venue.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
        specialLabel = String(specialLabel.trimmingCharacters(in: .whitespacesAndNewlines).prefix(30))
        let known = Set(currencyInfo.denominations)
        var clean: [String: [String: Int]] = [:]
        for col in OffertoryColumn.allCases {
            var row: [String: Int] = [:]
            for (label, units) in counts[col.rawValue] ?? [:] where known.contains(label) && units > 0 {
                row[label] = min(units, Offertory.maxUnits)
            }
            if !row.isEmpty { clean[col.rawValue] = row }
        }
        counts = clean
        var sigs = Array(signatures.prefix(2))
        while sigs.count < 2 { sigs.append(OffertorySignature()) }
        signatures = sigs
    }

    // MARK: Counting

    func units(_ column: OffertoryColumn, _ label: String) -> Int {
        counts[column.rawValue]?[label] ?? 0
    }

    mutating func setUnits(_ units: Int, _ column: OffertoryColumn, _ label: String) {
        guard currencyInfo.denominations.contains(label) else { return }
        var row = counts[column.rawValue] ?? [:]
        if units > 0 { row[label] = min(units, Offertory.maxUnits) } else { row[label] = nil }
        counts[column.rawValue] = row.isEmpty ? nil : row
    }

    /// The same sheet in another currency. Counts carry over only for notes
    /// and coins the new currency also has.
    func changingCurrency(to code: String) -> Offertory {
        Offertory(currency: code, venue: venue, specialLabel: specialLabel, counts: counts, signatures: signatures)
    }

    /// True when changing to `code` would drop some counts.
    func losesCounts(changingTo code: String) -> Bool {
        guard let other = OffertoryCurrency.find(code) else { return false }
        let kept = Set(other.denominations)
        return counts.values.contains { $0.keys.contains { !kept.contains($0) } }
    }

    var isEmpty: Bool { counts.isEmpty }
    var isSigned: Bool { signatures.contains { $0.isSigned } }

    func total(of column: OffertoryColumn) -> Int {
        let info = currencyInfo
        return (counts[column.rawValue] ?? [:]).reduce(0) { $0 + $1.value * info.minorUnits(of: $1.key) }
    }

    var totalMinor: Int { OffertoryColumn.allCases.reduce(0) { $0 + total(of: $1) } }

    /// Units of one note or coin across every column (the form's Total column).
    func totalUnits(_ label: String) -> Int {
        OffertoryColumn.allCases.reduce(0) { $0 + units($1, label) }
    }

    func title(of column: OffertoryColumn) -> String {
        column == .special && !specialLabel.isEmpty ? specialLabel : column.title
    }

    /// The form's four columns, plus an extra column only when it has a count.
    var printedColumns: [OffertoryColumn] {
        OffertoryColumn.allCases.filter { !$0.isExtra || total(of: $0) > 0 }
    }
}

// MARK: - Money as text

enum OffertoryMoney {
    /// Minor units → the form's two amount cells: 11500 fils → ("11", "500").
    static func split(_ minor: Int, _ currency: OffertoryCurrency) -> (major: String, minor: String) {
        let f = currency.factor
        let frac = String(minor % f)
        let padded = String(repeating: "0", count: max(0, currency.decimals - frac.count)) + frac
        return (String(minor / f), padded)
    }

    /// "1,234.500": thousands commas and the currency's decimals, no symbol.
    static func format(_ minor: Int, _ currency: OffertoryCurrency) -> String {
        let parts = split(minor, currency)
        return grouped(parts.major) + "." + parts.minor
    }

    /// "KWD 1,234.500".
    static func plain(_ minor: Int, _ currency: OffertoryCurrency) -> String {
        currency.code + " " + format(minor, currency)
    }

    /// Plain decimal without commas, for a spreadsheet: "1234.500".
    static func decimal(_ minor: Int, _ currency: OffertoryCurrency) -> String {
        let parts = split(minor, currency)
        return parts.major + "." + parts.minor
    }

    static func grouped(_ digits: String) -> String {
        var out = ""
        for (i, ch) in digits.reversed().enumerated() {
            if i > 0 && i % 3 == 0 { out.append(",") }
            out.append(ch)
        }
        return String(out.reversed())
    }

    private static let ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
                               "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
                               "eighteen", "nineteen"]
    private static let tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

    /// 222 → "two hundred and twenty-two" (whole numbers below a trillion).
    static func words(_ n: Int) -> String {
        if n < 0 { return String(n) }
        if n < 20 { return ones[n] }
        if n < 100 { return tens[n / 10] + (n % 10 > 0 ? "-" + ones[n % 10] : "") }
        if n < 1000 { return ones[n / 100] + " hundred" + (n % 100 > 0 ? " and " + words(n % 100) : "") }
        for (size, name) in [(1_000_000_000, "billion"), (1_000_000, "million"), (1_000, "thousand")] where n >= size {
            let rest = n % size
            return words(n / size) + " " + name + (rest > 0 ? (rest < 100 ? " and " : " ") + words(rest) : "")
        }
        return String(n)
    }

    /// "Two hundred and twenty-two Kuwaiti Dinars and 200/1000 fils", as written on the form.
    static func inWords(_ minor: Int, _ currency: OffertoryCurrency) -> String {
        let f = currency.factor
        let major = minor / f
        let rest = minor % f
        let w = words(major)
        let capital: String = w.prefix(1).uppercased() + String(w.dropFirst())
        let unit: String = major == 1 ? currency.name : currency.plural
        let tail: String = rest > 0 ? " and \(rest)/\(f) \(currency.minorName)" : " only"
        return capital + " " + unit + tail
    }
}

// MARK: - Printed sheet

/// Everything the PDF prints, in the paper form's layout.
struct OffertoryReport: Equatable {
    struct Cell: Equatable { var unit: String; var major: String; var minor: String }
    struct Row: Equatable { var label: String; var cells: [Cell] }

    var church: String
    var date: String
    var venue: String
    var columns: [String]
    var subheads: [String]
    var rows: [Row]
    var totalLabel: String
    var totals: [Cell]
    var wordsLabel: String
    var words: String
    var signatures: [OffertorySignature]
}

extension Offertory {
    /// "10 November 2026", the way the form's date is written.
    static func formDate(iso: String) -> String {
        let parse = DateFormatter()
        parse.calendar = Calendar(identifier: .gregorian)
        parse.locale = Locale(identifier: "en_US_POSIX")
        parse.timeZone = TimeZone(identifier: "UTC")
        parse.dateFormat = "yyyy-MM-dd"
        guard let d = parse.date(from: iso) else { return "" }
        let out = DateFormatter()
        out.calendar = Calendar(identifier: .gregorian)
        out.locale = Locale(identifier: "en_GB")
        out.timeZone = TimeZone(identifier: "UTC")
        out.dateFormat = "d MMMM yyyy"
        return out.string(from: d)
    }

    func report(parish: String, isoDate: String) -> OffertoryReport {
        let info = currencyInfo
        let cols = printedColumns
        func cell(units: Int, amount: Int) -> OffertoryReport.Cell {
            guard units > 0 else { return .init(unit: "", major: "", minor: "") }
            let parts = OffertoryMoney.split(amount, info)
            return .init(unit: String(units), major: parts.major, minor: parts.minor)
        }
        let rows = info.denominations.map { label -> OffertoryReport.Row in
            let value = info.minorUnits(of: label)
            var cells = cols.map { cell(units: units($0, label), amount: units($0, label) * value) }
            cells.append(cell(units: totalUnits(label), amount: totalUnits(label) * value))
            return .init(label: label, cells: cells)
        }
        var totals = cols.map { col -> OffertoryReport.Cell in
            let t = total(of: col)
            guard t > 0 else { return .init(unit: "", major: "", minor: "") }
            let parts = OffertoryMoney.split(t, info)
            return .init(unit: "", major: parts.major, minor: parts.minor)
        }
        let grand = OffertoryMoney.split(totalMinor, info)
        totals.append(.init(unit: "", major: grand.major, minor: grand.minor))
        let church = parish.trimmingCharacters(in: .whitespacesAndNewlines)
        return OffertoryReport(
            church: (church.isEmpty ? "Mar Thoma Church" : church).uppercased(),
            date: Offertory.formDate(iso: isoDate),
            venue: venue,
            columns: cols.map { title(of: $0).uppercased() } + ["TOTAL"],
            subheads: ["UNIT", info.code, info.minorName.uppercased()],
            rows: rows,
            totalLabel: "TOTAL " + info.code,
            totals: totals,
            wordsLabel: "(Amount in words) " + info.name + " :",
            words: OffertoryMoney.inWords(totalMinor, info),
            signatures: signatures
        )
    }

    /// Lines for a shared message: each printed column's total, then the total.
    var summaryLines: [String] {
        let info = currencyInfo
        return printedColumns.map { "\(title(of: $0)): \(OffertoryMoney.plain(total(of: $0), info))" }
            + ["Total offertory: \(OffertoryMoney.plain(totalMinor, info))"]
    }
}

// MARK: - Statistics

/// Offertory figures for the services counted in one currency. Amounts in
/// different currencies are never added together.
struct OffertorySummary: Equatable {
    var currency: String
    var services = 0
    var total = 0
    var columns: [OffertoryColumn: Int] = [:]
    var highest = 0
    var lowest = 0

    var average: Int { services > 0 ? Int((Double(total) / Double(services)).rounded()) : 0 }

    /// The form's four columns, plus an extra column only when it was used.
    var columnsShown: [OffertoryColumn] {
        OffertoryColumn.allCases.filter { !$0.isExtra || (columns[$0] ?? 0) > 0 }
    }

    /// Currencies offertories were counted in, most used first.
    static func currencies(in sheets: [Offertory]) -> [(code: String, services: Int)] {
        var n: [String: Int] = [:]
        for s in sheets where !s.isEmpty { n[s.currency, default: 0] += 1 }
        return n.map { (code: $0.key, services: $0.value) }
            .sorted { $0.services != $1.services ? $0.services > $1.services : $0.code < $1.code }
    }

    static func summarize(_ sheets: [Offertory], currency: String) -> OffertorySummary {
        var s = OffertorySummary(currency: currency)
        for sheet in sheets where !sheet.isEmpty && sheet.currency == currency {
            let t = sheet.totalMinor
            s.highest = s.services == 0 ? t : max(s.highest, t)
            s.lowest = s.services == 0 ? t : min(s.lowest, t)
            s.services += 1
            s.total += t
            for col in OffertoryColumn.allCases { s.columns[col, default: 0] += sheet.total(of: col) }
        }
        return s
    }
}
