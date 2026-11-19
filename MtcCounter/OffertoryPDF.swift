import UIKit

/// Draws the offertory counting sheet as a one-page landscape A4 PDF in the
/// layout of the church's paper form (the same layout as the web app's PDF).
enum OffertoryPDF {
    /// A4 landscape in points.
    static let pageSize = CGSize(width: 841.89, height: 595.28)
    private static let mm: CGFloat = 72.0 / 25.4

    static func data(for report: OffertoryReport) -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize))
        return renderer.pdfData { context in
            context.beginPage()
            draw(report, in: context.cgContext)
        }
    }

    /// One PDF with a sheet per report (used when sharing several services).
    static func data(for reports: [OffertoryReport]) -> Data {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize))
        return renderer.pdfData { context in
            for report in reports {
                context.beginPage()
                draw(report, in: context.cgContext)
            }
        }
    }

    // All positions below are in millimetres from the top-left of the page,
    // matching the web app's drawing code; `mm` converts to points.

    private enum Align { case left, center, right }

    private static func font(_ size: CGFloat, bold: Bool = false, italic: Bool = false) -> UIFont {
        if italic { return UIFont.italicSystemFont(ofSize: size) }
        return bold ? UIFont.boldSystemFont(ofSize: size) : UIFont.systemFont(ofSize: size)
    }

    /// Draw text with its baseline at `y` (mm).
    private static func text(_ string: String, x: CGFloat, y: CGFloat, font: UIFont, align: Align = .left) {
        guard !string.isEmpty else { return }
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.black]
        let width = (string as NSString).size(withAttributes: attributes).width
        var left = x * mm
        if align == .center { left -= width / 2 }
        if align == .right { left -= width }
        (string as NSString).draw(at: CGPoint(x: left, y: y * mm - font.ascender), withAttributes: attributes)
    }

    /// Centred text that shrinks when a narrow cell needs it.
    private static func fit(_ string: String, x: CGFloat, y: CGFloat, width: CGFloat, size: CGFloat, bold: Bool = false) {
        guard !string.isEmpty else { return }
        var s = size
        while s > 5 && (string as NSString).size(withAttributes: [.font: font(s, bold: bold)]).width > (width - 1) * mm {
            s -= 0.5
        }
        text(string, x: x, y: y, font: font(s, bold: bold), align: .center)
    }

    private static func line(_ cg: CGContext, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, width: CGFloat) {
        cg.setLineWidth(width * mm)
        cg.move(to: CGPoint(x: x1 * mm, y: y1 * mm))
        cg.addLine(to: CGPoint(x: x2 * mm, y: y2 * mm))
        cg.strokePath()
    }

    /// The first part of a string that fits in `width` mm.
    private static func clipped(_ string: String, width: CGFloat, font: UIFont) -> String {
        var s = string
        while !s.isEmpty && (s as NSString).size(withAttributes: [.font: font]).width > width * mm {
            s.removeLast()
        }
        return s
    }

    static func draw(_ r: OffertoryReport, in cg: CGContext) {
        let pageW: CGFloat = 297, left: CGFloat = 15, right: CGFloat = 297 - 15
        cg.setStrokeColor(UIColor.black.cgColor)
        cg.setFillColor(UIColor.black.cgColor)
        cg.setLineCap(.butt)

        // Heading
        text(r.church, x: pageW / 2, y: 18, font: font(14, bold: true), align: .center)
        text("OFFERTORY COLLECTION ON", x: left + 12, y: 28, font: font(8, bold: true))
        text("Venue :", x: 150, y: 28, font: font(8, bold: true))
        line(cg, left + 54, 28.8, 143, 28.8, width: 0.2)
        line(cg, 163, 28.8, right - 12, 28.8, width: 0.2)
        text(r.date, x: left + 56, y: 27.6, font: font(12))
        text(clipped(r.venue, width: right - 12 - 165, font: font(12)), x: 165, y: 27.6, font: font(12))

        // Table geometry: Denomination (value + X), then one group of
        // UNIT | major | minor per column (5 as on the paper form, up to 7).
        let groups = CGFloat(max(1, r.columns.count))
        let top: CGFloat = 34, headH: CGFloat = 8, subH: CGFloat = 6.5
        let rowCount = CGFloat(r.rows.count)
        let rowH = min(7.6, (150 - top - headH - subH) / (rowCount + 1))
        let denomW: CGFloat = 22, xW: CGFloat = 11
        let groupW = (right - left - denomW - xW) / groups
        let subW: [CGFloat] = [groupW * 0.27, groupW * 0.40, groupW * 0.33]
        func groupX(_ g: Int) -> CGFloat { left + denomW + xW + CGFloat(g) * groupW }
        func subX(_ g: Int, _ s: Int) -> CGFloat {
            var x = groupX(g)
            for i in 0..<s { x += subW[i] }
            return x
        }
        let bodyTop = top + headH + subH
        let bottom = bodyTop + rowH * (rowCount + 1)

        // Column headings
        text("Denomination", x: left + (denomW + xW) / 2, y: top + 5.4, font: font(9.5, bold: true), align: .center)
        for (g, name) in r.columns.enumerated() {
            fit(name, x: groupX(g) + groupW / 2, y: top + 5.4, width: groupW, size: 9.5, bold: true)
            for (s, head) in r.subheads.prefix(3).enumerated() {
                fit(head, x: subX(g, s) + subW[s] / 2, y: top + headH + 4.4, width: subW[s], size: 8)
            }
        }

        // Rows
        let last = r.columns.count - 1
        for (i, row) in r.rows.enumerated() {
            let y = bodyTop + rowH * CGFloat(i) + rowH * 0.68
            text(row.label, x: left + denomW / 2, y: y, font: font(10.5), align: .center)
            text("X", x: left + denomW + xW / 2, y: y, font: font(10.5), align: .center)
            for (g, cell) in row.cells.prefix(r.columns.count).enumerated() {
                let values = [cell.unit, cell.major, cell.minor]
                for s in 0..<3 {
                    fit(values[s], x: subX(g, s) + subW[s] / 2, y: y, width: subW[s], size: 10.5, bold: g == last)
                }
            }
        }

        // Total row
        let totalY = bodyTop + rowH * rowCount + rowH * 0.68
        text(r.totalLabel, x: left + (denomW + xW) / 2, y: totalY, font: font(9, bold: true), align: .center)
        for (g, total) in r.totals.prefix(r.columns.count).enumerated() where !total.major.isEmpty {
            fit(total.major, x: subX(g, 1) + subW[1] / 2, y: totalY, width: subW[1], size: 11, bold: true)
            fit(total.minor, x: subX(g, 2) + subW[2] / 2, y: totalY, width: subW[2], size: 11, bold: true)
        }

        // Grid lines: thick frame and group dividers, thin cell lines
        cg.setLineWidth(0.5 * mm)
        cg.stroke(CGRect(x: left * mm, y: top * mm, width: (right - left) * mm, height: (bottom - top) * mm))
        line(cg, left, top + headH, right, top + headH, width: 0.5)
        line(cg, left, bottom - rowH, right, bottom - rowH, width: 0.5)
        for g in 0..<r.columns.count { line(cg, groupX(g), top, groupX(g), bottom, width: 0.5) }
        line(cg, left + denomW, bodyTop, left + denomW, bottom - rowH, width: 0.2)
        line(cg, left, bodyTop, right, bodyTop, width: 0.2)
        if r.rows.count > 1 {
            for i in 1..<r.rows.count {
                line(cg, left, bodyTop + rowH * CGFloat(i), right, bodyTop + rowH * CGFloat(i), width: 0.2)
            }
        }
        for g in 0..<r.columns.count {
            for s in 1..<3 { line(cg, subX(g, s), top + headH, subX(g, s), bottom, width: 0.2) }
        }

        // Amount in words
        var y = bottom + 14
        let labelFont = font(8, bold: true)
        text(r.wordsLabel, x: left + 2, y: y, font: labelFont)
        let wordsX = left + 4 + (r.wordsLabel as NSString).size(withAttributes: [.font: labelFont]).width / mm
        text(clipped(r.words, width: right - 12 - wordsX - 2, font: font(12)), x: wordsX + 2, y: y - 0.6, font: font(12))
        line(cg, wordsX, y + 0.8, right - 12, y + 0.8, width: 0.2)

        // Signature lines, with any signatures drawn on screen and the names
        y += 21
        text("Signature (1):", x: left + 2, y: y, font: labelFont)
        text("Signature (2):", x: 160, y: y, font: labelFont)
        let lines: [(CGFloat, CGFloat)] = [(left + 26, 125), (184, right - 12)]
        let signH: CGFloat = 15
        let signW = signH * CGFloat(OffertorySignature.aspect)
        let grid = CGFloat(OffertorySignature.grid)
        for (i, span) in lines.enumerated() {
            cg.setStrokeColor(UIColor.black.cgColor)
            cg.setLineCap(.butt)
            line(cg, span.0, y + 0.8, span.1, y + 0.8, width: 0.2)
            guard i < r.signatures.count else { continue }
            let signature = r.signatures[i]
            let boxLeft = (span.0 + span.1) / 2 - signW / 2
            let boxTop = y + 0.8 - signH
            let ink = OffertorySignature.ink(signature.color)
            let colour = UIColor(red: CGFloat(ink.red) / 255, green: CGFloat(ink.green) / 255,
                                 blue: CGFloat(ink.blue) / 255, alpha: 1)
            cg.setStrokeColor(colour.cgColor)
            cg.setLineWidth(0.35 * mm)
            cg.setLineCap(.round)
            cg.setLineJoin(.round)
            for stroke in signature.strokes where stroke.count >= 2 {
                func point(_ k: Int) -> CGPoint {
                    CGPoint(x: (boxLeft + CGFloat(stroke[k]) / grid * signW) * mm,
                            y: (boxTop + CGFloat(stroke[k + 1]) / grid * signH) * mm)
                }
                let start = point(0)
                cg.move(to: start)
                if stroke.count == 2 {
                    cg.addLine(to: CGPoint(x: start.x + 0.1, y: start.y)) // a tap shows as a dot
                } else {
                    var k = 2
                    while k + 1 < stroke.count {
                        cg.addLine(to: point(k))
                        k += 2
                    }
                }
                cg.strokePath()
            }
            if !signature.name.isEmpty {
                text(clipped(signature.name, width: span.1 - span.0, font: font(9)),
                     x: (span.0 + span.1) / 2, y: y + 5, font: font(9), align: .center)
            }
        }
        cg.setStrokeColor(UIColor.black.cgColor)
        cg.setLineCap(.butt)

        let stamp = DateFormatter()
        stamp.dateStyle = .medium
        stamp.timeStyle = .short
        text("Generated by MTC Counter App · " + stamp.string(from: Date()), x: pageW / 2, y: 204,
             font: font(7, italic: true), align: .center)
    }
}
