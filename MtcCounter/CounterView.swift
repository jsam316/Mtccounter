import SwiftUI

struct CounterView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var showingSaveSheet = false

    var body: some View {
        NavigationStack {
            ScrollView {
                if horizontalSizeClass == .regular {
                    iPadContent
                } else {
                    phoneContent
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(isPresented: $showingSaveSheet) {
            SaveRecordView()
        }
    }

    // MARK: - Layout variants

    private var phoneContent: some View {
        VStack(spacing: 20) {
            headerView
            grandTotalCard
            CounterRow(label: "Male", count: $appState.male, color: .blue)
            CounterRow(label: "Female", count: $appState.female, color: .pink)
            actionButtons
            if !appState.rounds.isEmpty {
                RoundsSectionView()
            }
        }
        .padding()
    }

    @ViewBuilder private var iPadContent: some View {
        if !appState.rounds.isEmpty {
            HStack(alignment: .top, spacing: 24) {
                VStack(spacing: 20) { counterColumnContent }
                RoundsSectionView()
            }
            .padding(24)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        } else {
            VStack(spacing: 20) { counterColumnContent }
                .padding(24)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder private var counterColumnContent: some View {
        headerView
        grandTotalCard
        CounterRow(label: "Male", count: $appState.male, color: .blue)
        CounterRow(label: "Female", count: $appState.female, color: .pink)
        actionButtons
    }

    // MARK: - Shared subviews

    private var headerView: some View {
        VStack(spacing: 4) {
            Text("MTC Counter")
                .font(.largeTitle.bold())
            Text("MarThoma Church Attendance")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.top, 8)
    }

    private var grandTotalCard: some View {
        VStack(spacing: 6) {
            Text("\(appState.grandTotal)")
                .font(.system(size: 72, weight: .bold, design: .rounded))
                .foregroundColor(.indigo)
            Text("Grand Total")
                .font(.subheadline)
                .foregroundColor(.secondary)
            if !appState.rounds.isEmpty {
                Text("\(appState.rounds.count) round(s) saved")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button(action: {
                appState.addRound()
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            }) {
                Label("Add Round", systemImage: "plus.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.indigo)

            Button(action: { showingSaveSheet = true }) {
                Label("Save Record", systemImage: "square.and.arrow.down.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.green)
        }
    }
}

// MARK: - Counter Row

/// The whole row is the +1 target (easier to hit while counting a moving
/// line without looking down). The − button stays for corrections, and its
/// tap never also adds one.
struct CounterRow: View {
    let label: String
    @Binding var count: Int
    let color: Color

    private func increment() {
        count += 1
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.headline)
                    .foregroundColor(color)
                Text("Tap anywhere to add +1")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: {
                if count > 0 {
                    count -= 1
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                }
            }) {
                Image(systemName: "minus.circle.fill")
                    .font(.system(size: 38))
                    .foregroundColor(count > 0 ? color : Color(.systemGray4))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Subtract one \(label.lowercased())")

            Text("\(count)")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundColor(.primary)
                .frame(width: 80, alignment: .center)
                .contentTransition(.numericText())
                .animation(.spring(response: 0.3), value: count)
                .accessibilityHidden(true)

            Image(systemName: "plus.circle.fill")
                .font(.system(size: 38))
                .foregroundColor(color)
                .accessibilityHidden(true)
        }
        .padding()
        .background(color.opacity(0.08))
        .background(Color(.systemGray6))
        .cornerRadius(16)
        .contentShape(Rectangle())
        .onTapGesture(perform: increment)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(label): \(count)")
        .accessibilityHint("Tap to add one")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(.default, increment)
    }
}

// MARK: - Rounds Section

struct RoundsSectionView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Rounds")
                    .font(.headline)
                Spacer()
                Text("Total: \(appState.roundTotal)")
                    .font(.subheadline.bold())
                    .foregroundColor(.indigo)
                Button(action: { appState.clearRounds() }) {
                    Text("Clear")
                        .font(.subheadline)
                        .foregroundColor(.red)
                }
            }

            ForEach(Array(appState.rounds.enumerated()), id: \.element.id) { index, round in
                HStack {
                    Text("Round \(index + 1)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("\(round.male)M  \(round.female)F  = \(round.total)")
                        .font(.subheadline.monospacedDigit())
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.systemGray6))
                .cornerRadius(10)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
    }
}
