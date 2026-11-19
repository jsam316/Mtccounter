// Logic tests for the iOS app's model code (no UI). Run by run.sh.
import Foundation

var failures = 0
var passed = 0
func check(_ ok: Bool, _ name: String, file: String = #file, line: Int = #line) {
    if ok { passed += 1 } else { failures += 1; print("FAIL [line \(line)]: \(name)") }
}
func day(_ iso: String) -> Date { Lectionary.date(fromISO: iso)! }

// MARK: Lectionary (same rules as src/lectionary.js)

check(Lectionary.entry(for: day("2026-01-18"))?.theme == "Trusting in a Caring God", "Sunday theme")
check(Lectionary.entry(for: day("2026-01-18"))?.gospel == "Matthew 6:19-34", "Sunday Gospel")
let friday = Lectionary.entry(for: day("2026-01-16"))
check(friday?.theme == "Trusting in a Caring God" && friday?.weekly == true, "Friday takes the coming Sunday's theme")
check(friday?.gospel == nil, "Friday does not take the Sunday readings")
check(Lectionary.entry(for: day("2026-01-13"))?.theme == LectionaryData.entries["2026-01-11"]?.theme, "Tuesday takes the past Sunday's theme")
check(Lectionary.entry(for: day("2026-04-03"))?.theme == "Cross: The Celebration of Life", "Good Friday keeps its own theme")
let stThomas = Lectionary.entry(for: day("2026-07-03"))
check(stThomas?.occasion?.contains("Thomas") == true && stThomas?.theme == LectionaryData.entries["2026-07-05"]?.theme, "Friday occasion + week theme")
check(Lectionary.entry(for: day("2026-01-07")) == nil, "ordinary Wednesday has no entry")
check(Lectionary.isYearLoaded(day("2026-10-04")), "2026 is loaded")
check(Lectionary.isYearLoaded(day("2027-01-03")) == Lectionary.loadedYears.contains("2027"), "missing-year check")
check(Lectionary.isoString(day("2026-03-01")) == "2026-03-01", "ISO round-trip")

// Every Gospel parses, is a Gospel book, and its chapter exists.
for (date, e) in LectionaryData.entries {
    guard let g = e.gospel else { continue }
    let ref = ScriptureRef.parse(g)
    check(ref != nil, "\(date): \(g) parses")
    if let ref {
        check(["Matthew", "Mark", "Luke", "John"].contains(ref.book), "\(date): Gospel book")
        check((ref.chapter ?? 0) >= 1 && (ref.chapter ?? 99) <= ScriptureData.chapters(for: ref.book), "\(date): chapter exists")
        check((ref.verseFrom ?? 0) >= 1 && (ref.verseTo ?? 0) >= (ref.verseFrom ?? 0), "\(date): verse range")
    }
}

// MARK: Scripture references

check(ScriptureRef.parse("Luke 9:1-6") == ScriptureRef(book: "Luke", chapter: 9, verseFrom: 1, verseTo: 6), "Luke 9:1-6")
check(ScriptureRef.parse("1 John 3:1") == ScriptureRef(book: "1 John", chapter: 3, verseFrom: 1, verseTo: 1), "1 John 3:1 (not John)")
check(ScriptureRef.parse("Psalms 23") == ScriptureRef(book: "Psalms", chapter: 23, verseFrom: nil, verseTo: nil), "chapter only")
check(ScriptureRef.parse("Song of Solomon") == ScriptureRef(book: "Song of Solomon", chapter: nil, verseFrom: nil, verseTo: nil), "book only")
check(ScriptureRef.parse("St. Luke 9:1-6") == nil, "unknown book name")
check(ScriptureRef.parse("") == nil, "empty")

// MARK: Backup (web app format)

let t0 = Date(timeIntervalSince1970: 1_790_000_000)
let morning = AttendanceRecord(date: "October 4, 2026", isoDate: "2026-10-04", service: "Morning", parish: "St. Thomas",
                               celebrant: "Rev. A", scriptureReference: "John 15:12-19",
                               rounds: [Round(male: 3, female: 4, timestamp: t0)], totalMale: 40, totalFemale: 50,
                               notes: "Harvest festival", savedDate: t0)
let legacy = AttendanceRecord(date: "September 6, 2026", celebrant: "Rev. B", scriptureReference: "",
                              rounds: [], totalMale: 30, totalFemale: 35, notes: "", savedDate: t0)
check(legacy.resolvedISODate == "2026-09-06", "older record's display date is understood")

let data = try! BackupCodec.encode(records: [morning, legacy], celebrants: ["Rev. A"], parishes: ["St. Thomas"], now: t0)
let json = String(data: data, encoding: .utf8)!
check(json.contains("\"app\" : \"MTC Counter\"") && json.contains("\"mtcHistory\""), "web-format envelope")
check(json.contains("\"date\" : \"2026-10-04\"") && json.contains("\"parishName\" : \"St. Thomas\""), "web field names and ISO dates")

let decoded = try! BackupCodec.decode(data)
let intoEmpty = BackupCodec.merge(local: [], localCelebrants: [], localParishes: [], backup: decoded)
check(intoEmpty.records.count == 2 && intoEmpty.changed == 2, "round-trip restores both records")
let restored = intoEmpty.records.first { $0.service == "Morning" }
check(restored?.total == 90 && restored?.isoDate == "2026-10-04" && restored?.notes == "Harvest festival"
      && restored?.rounds.count == 1 && restored?.scriptureReference == "John 15:12-19", "round-trip keeps every field")

// A backup exactly as the web app writes it.
let webJSON = """
{"version":"1.0","exportedAt":"2026-10-08T07:00:00.000Z","app":"MTC Counter","data":{
 "mtcHistory":[
  {"date":"2026-10-04","service":"Morning","parishName":"St. Thomas","celebrant":"Rev. A","coCelebrants":"","sermon":"S",
   "scripture":"John 15:12-19","male":45,"female":55,"total":100,"rounds":[],"timestamp":"2026-10-04T12:00:00.000Z"},
  {"date":"2026-10-04","service":"Evening","parishName":"St. Thomas","celebrant":"Rev. A","male":"10","female":12,
   "timestamp":"2026-10-04T18:00:00.000Z"}
 ],
 "savedCelebrants":["Rev. A","Rev. C"],"savedParishes":["Ebenezer"]}}
"""
let web = try! BackupCodec.decode(webJSON.data(using: .utf8)!)
check(web.data.mtcHistory.count == 2 && web.data.mtcHistory[1].male == 10, "lenient decoding of web records")
let merged = BackupCodec.merge(local: [morning, legacy], localCelebrants: ["Rev. A", "Rev. B"],
                               localParishes: ["St. Thomas"], backup: web)
check(merged.records.count == 3, "Evening added beside Morning; nothing deleted")
check(merged.records.first { $0.service == "Morning" }?.total == 100, "newer Morning record wins")
check(merged.changed == 2, "one added + one replaced")
check(merged.celebrants == ["Rev. A", "Rev. B", "Rev. C"] && merged.parishes == ["Ebenezer", "St. Thomas"], "names combined")
let older = try! BackupCodec.decode("""
{"version":"1.0","exportedAt":"x","app":"MTC Counter","data":{"mtcHistory":[
 {"date":"2026-10-04","service":"morning ","male":1,"female":1,"timestamp":"2020-01-01T00:00:00Z"}]}}
""".data(using: .utf8)!)
let kept = BackupCodec.merge(local: [morning], localCelebrants: [], localParishes: [], backup: older)
check(kept.records.count == 1 && kept.records[0].total == 90 && kept.changed == 0, "older record never overwrites; service match ignores case/space")

do {
    _ = try BackupCodec.decode("{\"version\":\"1\",\"exportedAt\":\"x\",\"app\":\"Other\",\"data\":{\"mtcHistory\":[]}}".data(using: .utf8)!)
    check(false, "foreign backup rejected")
} catch BackupError.notAnMtcBackup {
    check(true, "foreign backup rejected")
} catch {
    check(false, "foreign backup rejected with the right error")
}

// Older saved records (no isoDate/service keys) still decode.
let oldRecordJSON = """
{"id":"\(UUID().uuidString)","date":"May 3, 2026","celebrant":"Rev. A","scriptureReference":"","rounds":[],
 "totalMale":1,"totalFemale":2,"notes":"","savedDate":0}
"""
let oldRecord = try? JSONDecoder().decode(AttendanceRecord.self, from: oldRecordJSON.data(using: .utf8)!)
check(oldRecord?.service == "" && oldRecord?.isoDate == "" && oldRecord?.resolvedISODate == "2026-05-03", "older saved records still load")

// MARK: Offertory (same rules and the same sample as tests/offertory.test.js:
// the church's own filled-in sheet of 10 November 2026)

let kwd = OffertoryCurrency.find("KWD")!
check(kwd.denominations == ["20", "10", "5", "1", "0.500", "0.250", "0.100", "0.050", "0.020", "0.010", "0.005"], "KWD notes and coins match the paper form")
check(kwd.decimals == 3 && kwd.factor == 1000 && kwd.minorName == "fils", "KWD has 1000 fils")
check(kwd.minorUnits(of: "0.500") == 500 && kwd.minorUnits(of: "20") == 20000 && kwd.minorUnits(of: "0.005") == 5, "note and coin values")
let inr = OffertoryCurrency.find("INR")!
check(inr.minorUnits(of: "500") == 50000 && inr.factor == 100, "INR values")
check(OffertoryCurrency.find("USD")!.minorUnits(of: "0.25") == 25, "USD quarter")
check(OffertoryData.currencies.count == 17, "17 currencies")
for c in OffertoryData.currencies {
    let values = c.denominations.map { c.minorUnits(of: $0) }
    check(values == values.sorted(by: >) && Set(values).count == values.count && values.allSatisfy { $0 > 0 }, "\(c.code): descending, unique, positive")
}

var sample = Offertory.empty(currency: "KWD", venue: "NECK - Hall of Peace")
sample.specialLabel = "Family Day"
for (label, units) in ["10": 2, "1": 36, "0.500": 23, "0.250": 18, "0.100": 1, "0.050": 2] { sample.setUnits(units, .offertory, label) }
sample.setUnits(2, .birthday, "5")
sample.setUnits(4, .wedding, "10")
sample.setUnits(2, .special, "20")
sample.setUnits(6, .special, "10")

check(OffertoryMoney.format(sample.total(of: .offertory), kwd) == "72.200", "Offertory column total")
check(OffertoryMoney.format(sample.total(of: .birthday), kwd) == "10.000", "Birthday column total")
check(OffertoryMoney.format(sample.total(of: .wedding), kwd) == "40.000", "Wedding column total")
check(OffertoryMoney.format(sample.total(of: .special), kwd) == "100.000", "Special column total")
check(sample.totalMinor == 222200 && OffertoryMoney.plain(sample.totalMinor, kwd) == "KWD 222.200", "grand total")
check(sample.totalUnits("10") == 12 && sample.totalUnits("0.005") == 0, "Total column adds units across columns")
check(!sample.isEmpty && !sample.isSigned, "counted, not signed")
check(sample.printedColumns == [.offertory, .birthday, .wedding, .special], "extra columns not printed when unused")

// Amounts as text
check(OffertoryMoney.split(11500, kwd) == ("11", "500") && OffertoryMoney.split(100, kwd) == ("0", "100"), "split into the form's two cells")
check(OffertoryMoney.format(125050, inr) == "1,250.50" && OffertoryMoney.format(1234567890, inr) == "12,345,678.90", "thousands commas")
check(OffertoryMoney.decimal(125050, inr) == "1250.50", "plain decimal for spreadsheets")
check(OffertoryMoney.inWords(222200, kwd) == "Two hundred and twenty-two Kuwaiti Dinars and 200/1000 fils", "amount in words")
check(OffertoryMoney.inWords(1000, kwd) == "One Kuwaiti Dinar only", "one dinar")
check(OffertoryMoney.inWords(125050, inr) == "One thousand two hundred and fifty Indian Rupees and 50/100 paise", "rupees in words")
check(OffertoryMoney.inWords(500, kwd) == "Zero Kuwaiti Dinars and 500/1000 fils", "under one dinar")
check(OffertoryMoney.words(0) == "zero" && OffertoryMoney.words(19) == "nineteen" && OffertoryMoney.words(40) == "forty", "small numbers")
check(OffertoryMoney.words(101) == "one hundred and one" && OffertoryMoney.words(1005) == "one thousand and five", "hundreds and thousands")
check(OffertoryMoney.words(12345) == "twelve thousand three hundred and forty-five" && OffertoryMoney.words(2000000) == "two million", "larger numbers")

// The printed sheet
let rep = sample.report(parish: "St. Thomas Mar Thoma Church - Kuwait", isoDate: "2026-11-10")
check(rep.church == "ST. THOMAS MAR THOMA CHURCH - KUWAIT" && rep.date == "10 November 2026" && rep.venue == "NECK - Hall of Peace", "sheet heading")
check(rep.columns == ["OFFERTORY", "BIRTHDAY", "WEDDING", "FAMILY DAY", "TOTAL"] && rep.subheads == ["UNIT", "KWD", "FILS"], "sheet columns")
check(rep.rows.count == 11 && rep.rows[1].label == "10", "one row per note or coin")
check(rep.rows[1].cells == [
    .init(unit: "2", major: "20", minor: "000"), .init(unit: "", major: "", minor: ""),
    .init(unit: "4", major: "40", minor: "000"), .init(unit: "6", major: "60", minor: "000"),
    .init(unit: "12", major: "120", minor: "000"),
], "the 10 KWD row")
check(rep.rows[4].cells[0] == .init(unit: "23", major: "11", minor: "500"), "the half-dinar cell")
check(rep.totals.map { $0.major + "." + $0.minor } == ["72.200", "10.000", "40.000", "100.000", "222.200"] && rep.totalLabel == "TOTAL KWD", "total row")
check(rep.wordsLabel == "(Amount in words) Kuwaiti Dinar :" && rep.words == "Two hundred and twenty-two Kuwaiti Dinars and 200/1000 fils", "words on the sheet")
check(Offertory.empty().report(parish: "  ", isoDate: "bad").church == "MAR THOMA CHURCH", "default church name")
check(sample.summaryLines == ["Offertory: KWD 72.200", "Birthday: KWD 10.000", "Wedding: KWD 40.000", "Family Day: KWD 100.000", "Total offertory: KWD 222.200"], "shared summary")

// Family Day and Upakoshanam: counted, printed only when used
var more = sample
more.setUnits(1, .familyDay, "20"); more.setUnits(3, .familyDay, "0.500"); more.setUnits(4, .upakoshanam, "5")
check(more.total(of: .familyDay) == 21500 && more.total(of: .upakoshanam) == 20000 && more.totalMinor == 263700, "extra columns add to the total")
check(more.report(parish: "", isoDate: "").columns == ["OFFERTORY", "BIRTHDAY", "WEDDING", "FAMILY DAY", "FAMILY DAY", "UPAKOSHANAM", "TOTAL"], "extra columns printed when used")
check(more.report(parish: "", isoDate: "").rows[0].cells.count == 7, "seven groups per row")

// Counting rules
var edit = Offertory.empty(currency: "KWD")
edit.setUnits(5, .offertory, "7")              // not a KWD note
edit.setUnits(-3, .offertory, "20")
edit.setUnits(1_000_000, .offertory, "10")
check(edit.units(.offertory, "7") == 0 && edit.units(.offertory, "20") == 0 && edit.units(.offertory, "10") == Offertory.maxUnits, "unknown notes, negatives and huge counts")
edit.setUnits(0, .offertory, "10")
check(edit.isEmpty, "zero removes the count")
let asINR = sample.changingCurrency(to: "INR")
check(asINR.currency == "INR" && asINR.units(.offertory, "10") == 2 && asINR.units(.offertory, "0.500") == 0 && asINR.units(.special, "20") == 2, "currency change keeps only shared notes and coins")
check(sample.losesCounts(changingTo: "INR") && !Offertory.empty().losesCounts(changingTo: "INR"), "knows when a change drops counts")
check(sample.changingCurrency(to: "XXX").currency == "KWD", "unknown currency falls back")

// Signatures
var signed = sample
signed.signatures[0] = OffertorySignature(name: "  Thomas Mathew  ", strokes: [[100, 500, 300, 200, 520, 800], [900, 500]], color: "blue")
check(signed.isSigned && signed.signatures[0].name == "Thomas Mathew" && signed.signatures[0].color == "blue", "signed sheet")
let messy = OffertorySignature(name: String(repeating: "x", count: 100), strokes: [[-5, 2000, 7, 11, 9], [1], [], [3, 4]], color: "yellow")
check(messy.strokes == [[0, 1000, 7, 11], [3, 4]] && messy.color == "black" && messy.name.count == 60, "bad signature data is clamped")
check(OffertorySignature(strokes: Array(repeating: [1, 2], count: 500)).strokes.count == OffertorySignature.maxStrokes, "stroke count is capped")
check(OffertorySignature.inks.map { $0.key } == ["black", "blue", "navy"] && OffertorySignature.ink("nope").key == "black", "three pen colours")
check(signed.report(parish: "", isoDate: "").signatures[0].strokes.count == 2 && signed.totalMinor == sample.totalMinor, "signature reaches the sheet, amounts unchanged")

// The web app's JSON, both ways
let webSheetJSON = """
{"currency":"KWD","venue":"<b>Hall</b>","specialLabel":"Family Day","hacked":true,"total":9e9,"totalMinor":9000000000000,
 "counts":{"offertory":{"20":2,"0.500":"3","7":99,"10":-4},"bogus":{"20":5},"wedding":{"10":4.0}},
 "signatures":[{"name":"A","color":"red;x","strokes":[[1,2,99999,-5],"x",[5]]}]}
"""
let webSheet = try! JSONDecoder().decode(Offertory.self, from: webSheetJSON.data(using: .utf8)!)
check(webSheet.counts == ["offertory": ["20": 2, "0.500": 3], "wedding": ["10": 4]], "web sheet: unknown keys, notes and negatives dropped")
check(webSheet.totalMinor == 81500, "web sheet: total recalculated, not trusted")
check(webSheet.signatures.count == 2 && webSheet.signatures[0].color == "black", "web sheet: two signatures, colour cleaned")
check(webSheet.venue == "<b>Hall</b>", "text is kept as text")
let reencoded = String(data: try! JSONEncoder().encode(sample), encoding: .utf8)!
check(reencoded.contains("\"totalMinor\":222200") && reencoded.contains("\"familyDay\":{}") && reencoded.contains("\"upakoshanam\":{}"), "writes the web app's shape")
check(try! JSONDecoder().decode(Offertory.self, from: reencoded.data(using: .utf8)!) == sample, "sheet round-trips")
check((try? JSONDecoder().decode(Offertory.self, from: "{}".data(using: .utf8)!))?.isEmpty == true, "empty object is an empty sheet")

// A record keeps its sheet through a backup
let withSheet = AttendanceRecord(date: "November 10, 2026", isoDate: "2026-11-10", service: "", parish: "St. Thomas",
                                 celebrant: "Rev. A", scriptureReference: "", rounds: [], totalMale: 86, totalFemale: 107,
                                 notes: "", savedDate: t0, offertory: signed)
let sheetBackup = try! BackupCodec.decode(try! BackupCodec.encode(records: [withSheet, morning], celebrants: [], parishes: [], now: t0))
let sheetMerged = BackupCodec.merge(local: [], localCelebrants: [], localParishes: [], backup: sheetBackup)
let backFromBackup = sheetMerged.records.first { $0.isoDate == "2026-11-10" }
check(backFromBackup?.offertory == signed, "offertory and signatures survive a backup")
check(sheetMerged.records.first { $0.service == "Morning" }?.offertory == nil, "a record without a sheet stays without one")
let storedRecord = try! JSONDecoder().decode(AttendanceRecord.self, from: try! JSONEncoder().encode(withSheet))
check(storedRecord.offertory == signed, "record with a sheet saves and loads")
check(oldRecord?.offertory == nil, "older saved records have no sheet")

// MARK: Hardening: a hostile backup

let hostile = """
{"version":"1.0","exportedAt":"x","app":"MTC Counter","data":{"mtcHistory":[
  {"date":"2026-11-17","service":{"x":1},"parishName":"=HYPERLINK(1)","celebrant":"A\\u0000B\\u0007C","sermon":"\(String(repeating: "s", count: 900))",
   "male":"5","female":-9,"total":1e308,"rounds":[{"male":"x"},{"male":1,"female":2},7],"timestamp":"junk",
   "offertory":{"currency":"KWD","totalMinor":9e15,"counts":{"offertory":{"20":3}}}},
  {"date":12345},
  null,
  "junk",
  {"service":"no date"},
  {"date":"   ","male":1,"female":1}
 ],"savedCelebrants":["Rev. A",7,null,"  ","Rev. A","Rev. B"],"savedParishes":"not a list"}}
"""
let hostileBackup = try! BackupCodec.decode(hostile.data(using: .utf8)!)
check(hostileBackup.data.mtcHistory.count == 2, "unusable entries are skipped, not fatal")
let cleaned = BackupCodec.merge(local: [morning], localCelebrants: ["Rev. Z"], localParishes: ["St. Thomas"], backup: hostileBackup)
check(cleaned.records.count == 2 && cleaned.changed == 1, "only the one usable record is merged; local data is kept")
let hr = cleaned.records.first { $0.isoDate == "2026-11-17" }
check(hr?.service == "" && hr?.celebrant == "ABC" && hr?.sermon.count == 200, "wrong types dropped, control characters removed, text capped")
check(hr?.totalMale == 5 && hr?.totalFemale == 0 && hr?.total == 5, "counts corrected and total recalculated")
check(hr?.rounds.count == 1 && hr?.rounds.first?.total == 3, "bad rounds skipped")
check(hr?.offertory?.totalMinor == 60000, "offertory total recalculated")
check(cleaned.celebrants == ["Rev. A", "Rev. B", "Rev. Z"] && cleaned.parishes == ["St. Thomas"], "names cleaned and de-duplicated")
check(BackupCodec.cleanCount(2_000_000_000) == BackupCodec.maxCount && BackupCodec.cleanCount(-1) == 0, "counts are bounded")
check(BackupCodec.cleanText("  two\nlines\t ok  ", 50) == "two\nlines\t ok", "normal text is untouched")

do {
    _ = try BackupCodec.decode(Data(count: BackupCodec.maxFileBytes + 1))
    check(false, "oversized backup refused")
} catch BackupError.tooLarge {
    check(true, "oversized backup refused")
} catch {
    check(false, "oversized backup refused with the right error")
}

// CSV cells cannot run as spreadsheet formulas
check(BackupCodec.csvCell("St. Thomas") == "\"St. Thomas\"" && BackupCodec.csvCell("He said \"hi\"") == "\"He said \"\"hi\"\"\"", "normal CSV quoting")
check(BackupCodec.csvCell("=HYPERLINK(\"x\")") == "\"'=HYPERLINK(\"\"x\"\")\"", "formula is made text")
for start in ["=", "+", "-", "@", "\t", "\r"] { check(BackupCodec.csvCell(start + "cmd").hasPrefix("\"'"), "cell starting with \(start.debugDescription)") }
check(BackupCodec.csvCell("a=b") == "\"a=b\"" && BackupCodec.csvCell("") == "\"\"", "only the first character matters")

// MARK: Offertory statistics

var second = Offertory.empty(currency: "KWD")
second.setUnits(3, .offertory, "20"); second.setUnits(1, .offertory, "0.500"); second.setUnits(2, .upakoshanam, "5")
var rupees = Offertory.empty(currency: "INR")
rupees.setUnits(4, .offertory, "500"); rupees.setUnits(5, .offertory, "100")
let sheets = [sample, second, Offertory.empty(), rupees]
let used = OffertorySummary.currencies(in: sheets)
check(used.map { $0.code } == ["KWD", "INR"] && used.map { $0.services } == [2, 1], "currencies, most used first; empty sheets ignored")
let st = OffertorySummary.summarize(sheets, currency: "KWD")
check(st.services == 2 && st.total == 292700 && st.average == 146350, "KWD totals and average")
check(st.highest == 222200 && st.lowest == 70500, "highest and lowest service")
check(st.columns[.offertory] == 132700 && st.columns[.special] == 100000 && st.columns[.upakoshanam] == 10000 && st.columns[.familyDay] == 0, "by type")
check(st.columns.values.reduce(0, +) == st.total, "types add up to the total")
check(st.columnsShown == [.offertory, .birthday, .wedding, .special, .upakoshanam], "extra types listed only when used")
let stINR = OffertorySummary.summarize(sheets, currency: "INR")
check(stINR.services == 1 && stINR.total == 250000 && stINR.average == 250000, "currencies are kept apart")
let stNone = OffertorySummary.summarize(sheets, currency: "USD")
check(stNone.services == 0 && stNone.total == 0 && stNone.average == 0, "no services in a currency")

print("\(passed) passed, \(failures) failed")
exit(failures == 0 ? 0 : 1)
