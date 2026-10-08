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

print("\(passed) passed, \(failures) failed")
exit(failures == 0 ? 0 : 1)
