import Foundation

/// One Mar Thoma Sabha lectionary entry. `gospel` is in Scripture-picker
/// form, e.g. "Luke 9:1-6". `weekly` marks a Friday/Tuesday that inherited
/// the Sunday theme.
struct LectionaryEntry: Equatable {
    let occasion: String?
    let theme: String?
    let gospel: String?
    var weekly: Bool = false

    init(occasion: String?, theme: String?, gospel: String?, weekly: Bool = false) {
        self.occasion = occasion
        self.theme = theme
        self.gospel = gospel
        self.weekly = weekly
    }
}

/// Same rules as the web app (src/lectionary.js), on the same data
/// (LectionaryData.swift is generated from it).
enum Lectionary {
    private static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c
    }()

    private static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// "2026-10-04" for a date in the user's time zone.
    static func isoString(_ date: Date) -> String { isoFormatter.string(from: date) }

    /// Parses "2026-10-04"; nil if not in that form.
    static func date(fromISO iso: String) -> Date? { isoFormatter.date(from: iso) }

    /// Years ("2026") that have lectionary data.
    static let loadedYears: Set<String> = Set(LectionaryData.entries.keys.map { String($0.prefix(4)) })

    static func isYearLoaded(_ date: Date) -> Bool {
        loadedYears.contains(String(isoString(date).prefix(4)))
    }

    /// The entry for a date. A day's own theme always wins. A Friday or
    /// Tuesday without one takes the theme of the coming (Friday) or past
    /// (Tuesday) Sunday; it keeps its own occasion but not the Sunday's
    /// readings.
    static func entry(for date: Date) -> LectionaryEntry? {
        let iso = isoString(date)
        let exact = LectionaryData.entries[iso]
        if let exact, exact.theme != nil { return exact }

        let weekday = calendar.component(.weekday, from: date) // 1 = Sunday
        let offset: Int
        switch weekday {
        case 6: offset = 2   // Friday → coming Sunday
        case 3: offset = -2  // Tuesday → past Sunday
        default: return exact
        }
        guard let sundayDate = calendar.date(byAdding: .day, value: offset, to: date),
              let sunday = LectionaryData.entries[isoString(sundayDate)],
              let theme = sunday.theme else { return exact }
        return LectionaryEntry(occasion: exact?.occasion, theme: theme, gospel: nil, weekly: true)
    }

    static func entry(forISO iso: String) -> LectionaryEntry? {
        guard let d = date(fromISO: iso) else { return nil }
        return entry(for: d)
    }
}

/// A Scripture reference split into the picker's parts.
struct ScriptureRef: Equatable {
    let book: String
    let chapter: Int?
    let verseFrom: Int?
    let verseTo: Int?

    /// Parses "Luke 9:1-6", "1 John 3:1", "Psalms 23" or "Ruth"; nil when
    /// the book isn't one the picker knows.
    static func parse(_ text: String) -> ScriptureRef? {
        let s = text.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return nil }
        // Longest book name that prefixes the text, so "1 John" beats "John".
        let books = ScriptureData.bookNames.sorted { $0.count > $1.count }
        guard let book = books.first(where: { s == $0 || s.hasPrefix($0 + " ") }) else { return nil }
        let rest = s.dropFirst(book.count).trimmingCharacters(in: .whitespaces)
        if rest.isEmpty { return ScriptureRef(book: book, chapter: nil, verseFrom: nil, verseTo: nil) }

        let parts = rest.split(separator: ":", maxSplits: 1).map(String.init)
        guard let chapter = Int(parts[0]) else { return nil }
        guard parts.count == 2 else { return ScriptureRef(book: book, chapter: chapter, verseFrom: nil, verseTo: nil) }
        let verses = parts[1].split(separator: "-", maxSplits: 1).map { Int($0.trimmingCharacters(in: .whitespaces)) }
        guard let from = verses.first ?? nil else { return nil }
        let to = verses.count > 1 ? (verses[1] ?? from) : from
        return ScriptureRef(book: book, chapter: chapter, verseFrom: from, verseTo: to)
    }
}
