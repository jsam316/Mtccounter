import SwiftUI
import WatchKit

struct WatchRoundsView: View {
    @EnvironmentObject var appState: WatchAppState
    @State private var showingClearConfirm = false

    var body: some View {
        VStack(spacing: 4) {
            if appState.rounds.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "list.bullet.circle")
                        .font(.title2)
                        .foregroundColor(.secondary)
                    Text("No rounds")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                HStack {
                    Text("\(appState.rounds.count) rounds")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("Total: \(appState.roundTotal)")
                        .font(.caption.bold())
                        .foregroundColor(.indigo)
                }
                Text("M \(appState.roundMaleTotal)  ·  F \(appState.roundFemaleTotal)")
                    .font(.caption2.monospacedDigit())
                    .foregroundColor(.secondary)

                // Swipe a round left to remove just that one.
                List {
                    ForEach(Array(appState.rounds.enumerated()), id: \.element.id) { i, round in
                        HStack {
                            Text("R\(i + 1)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("\(round.male)M \(round.female)F")
                                .font(.caption.monospacedDigit())
                            Text("=\(round.total)")
                                .font(.caption.bold())
                                .foregroundColor(.indigo)
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                appState.removeRound(id: round.id)
                                WKInterfaceDevice.current().play(.click)
                            } label: {
                                Label("Remove", systemImage: "trash")
                            }
                        }
                    }
                }
                .listStyle(.plain)

                Button(role: .destructive, action: { showingClearConfirm = true }) {
                    Label("Clear", systemImage: "trash")
                        .font(.caption)
                }
                .buttonStyle(.bordered)
                .tint(.red)
            }
        }
        .navigationTitle("Rounds")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Clear all rounds?", isPresented: $showingClearConfirm) {
            Button("Clear", role: .destructive) {
                appState.clearRounds()
                WKInterfaceDevice.current().play(.failure)
            }
        }
    }
}
