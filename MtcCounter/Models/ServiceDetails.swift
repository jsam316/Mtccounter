import Foundation

/// The details of the service being recorded: date, parish, celebrant,
/// sermon and reading. They are entered before counting starts (as in the
/// web app), kept while the service is in progress, and stored with the
/// record when it is saved.
///
/// Foundation only: the tests in tools/swift-tests compile this file as is.
struct ServiceDetails: Codable, Equatable {
    var serviceDate: Date = Date()
    var service: String = ""
    var parish: String = ""
    var celebrant: String = ""
    var coCelebrantsEnabled: Bool = false
    /// Typed names, used when there is no saved celebrant list to pick from.
    var coCelebrantsText: String = ""
    /// Names picked from the saved celebrant list.
    var selectedCoCelebrants: [String] = []
    var sermon: String = ""
    var scriptureBook: String = ""
    var scriptureChapter: Int = 1
    var verseFrom: String = ""
    var verseTo: String = ""
    var notes: String = ""

    // What the lectionary last filled in, so a date change can replace its
    // own suggestion but never something typed or picked by hand.
    var lastThemeFill: String?
    var lastScriptureFill: String?

    init() {}

    enum CodingKeys: String, CodingKey {
        case serviceDate, service, parish, celebrant, coCelebrantsEnabled, coCelebrantsText, selectedCoCelebrants
        case sermon, scriptureBook, scriptureChapter, verseFrom, verseTo, notes, lastThemeFill, lastScriptureFill
    }

    /// Lenient: a missing or damaged field falls back to its default.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func text(_ k: CodingKeys) -> String { (try? c.decode(String.self, forKey: k)) ?? "" }
        serviceDate = (try? c.decode(Date.self, forKey: .serviceDate)) ?? Date()
        service = text(.service)
        parish = text(.parish)
        celebrant = text(.celebrant)
        coCelebrantsEnabled = (try? c.decode(Bool.self, forKey: .coCelebrantsEnabled)) ?? false
        coCelebrantsText = text(.coCelebrantsText)
        selectedCoCelebrants = (try? c.decode([String].self, forKey: .selectedCoCelebrants)) ?? []
        sermon = text(.sermon)
        scriptureBook = text(.scriptureBook)
        scriptureChapter = max(1, (try? c.decode(Int.self, forKey: .scriptureChapter)) ?? 1)
        verseFrom = text(.verseFrom)
        verseTo = text(.verseTo)
        notes = text(.notes)
        lastThemeFill = try? c.decode(String.self, forKey: .lastThemeFill)
        lastScriptureFill = try? c.decode(String.self, forKey: .lastScriptureFill)
    }

    // MARK: Derived values

    /// "2026-11-10"
    var isoDate: String { Lectionary.isoString(serviceDate) }

    /// "November 10, 2026" in the phone's language (how records show their date).
    var displayDate: String {
        let f = DateFormatter()
        f.dateStyle = .long
        return f.string(from: serviceDate)
    }

    /// "Matthew 6:19-34", "Psalms 23", or "" when no book is chosen.
    var scriptureString: String {
        guard !scriptureBook.isEmpty else { return "" }
        var ref = "\(scriptureBook) \(scriptureChapter)"
        if !verseFrom.isEmpty {
            ref += ":\(verseFrom)"
            if !verseTo.isEmpty && verseTo != verseFrom { ref += "-\(verseTo)" }
        }
        return ref
    }

    /// The co-celebrants to store: picked names when there is a saved
    /// celebrant list, typed names otherwise; nothing when switched off.
    func coCelebrants(fromList: Bool) -> String {
        guard coCelebrantsEnabled else { return "" }
        return fromList ? selectedCoCelebrants.sorted().joined(separator: ", ") : coCelebrantsText
    }

    /// One line for the Counter tab: "Tue, 10 Nov · Morning · St. Thomas · Rev. A".
    var recap: String {
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate("EEEdMMM")
        let parts = [f.string(from: serviceDate), service, parish, celebrant]
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        return parts.joined(separator: " · ")
    }

    /// True when only the date is set: nothing has been typed or picked.
    var isBlank: Bool {
        service.isEmpty && parish.isEmpty && celebrant.isEmpty && sermon.isEmpty && scriptureBook.isEmpty
            && notes.isEmpty && coCelebrantsText.isEmpty && selectedCoCelebrants.isEmpty
    }

    // MARK: Lectionary

    var lectionaryEntry: LectionaryEntry? { Lectionary.entry(for: serviceDate) }

    mutating func setScripture(_ ref: ScriptureRef?) {
        scriptureBook = ref?.book ?? ""
        scriptureChapter = ref?.chapter ?? 1
        verseFrom = ref?.verseFrom.map { String($0) } ?? ""
        verseTo = ref?.verseTo.map { String($0) } ?? ""
    }

    /// Fill the sermon title and reading from the lectionary when they are
    /// empty or still hold an earlier suggestion; `force` applies them
    /// regardless (tapping the hint).
    mutating func applyLectionary(force: Bool = false) {
        let entry = lectionaryEntry
        let themeIsOurs = lastThemeFill != nil && sermon == lastThemeFill
        if let theme = entry?.theme {
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
        if let gospel = entry?.gospel, let ref = ScriptureRef.parse(gospel) {
            if force || scriptureBook.isEmpty || scriptureIsOurs {
                setScripture(ref)
                lastScriptureFill = scriptureString
            }
        } else if scriptureIsOurs {
            setScripture(nil)
            lastScriptureFill = nil
        }
    }

    // MARK: Next service

    /// Fresh details for the next service: `date`, with the same parish and
    /// celebrant offered again.
    func nextService(on date: Date = Date()) -> ServiceDetails {
        var next = ServiceDetails()
        next.serviceDate = date
        next.parish = parish
        next.celebrant = celebrant
        return next
    }
}
