import SwiftUI
import WatchKit

struct WatchCounterView: View {
    @EnvironmentObject var appState: WatchAppState

    var body: some View {
        VStack(spacing: 4) {
            // Grand total
            Text("\(appState.grandTotal)")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundColor(.indigo)
                .contentTransition(.numericText())
                .animation(.spring(response: 0.3), value: appState.grandTotal)

            Divider()

            // Male row
            CounterRowWatch(
                label: "M",
                count: $appState.male,
                color: .blue
            )

            // Female row
            CounterRowWatch(
                label: "F",
                count: $appState.female,
                color: .pink
            )

            // Add round button
            Button(action: {
                appState.addRound()
                WKInterfaceDevice.current().play(.success)
            }) {
                Label("+ Round", systemImage: "plus.circle")
                    .font(.caption.bold())
            }
            .buttonStyle(.borderedProminent)
            .tint(.indigo)
        }
        .navigationTitle("MTC")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Watch Counter Row

struct CounterRowWatch: View {
    let label: String
    @Binding var count: Int
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.caption.bold())
                .foregroundColor(color)
                .frame(width: 14)

            Button(action: {
                if count > 0 {
                    count -= 1
                    WKInterfaceDevice.current().play(.click)
                }
            }) {
                Image(systemName: "minus.circle.fill")
                    .foregroundColor(count > 0 ? color : Color(.darkGray))
                    .font(.title3)
            }
            .buttonStyle(.plain)

            Text("\(count)")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(.primary)
                .frame(minWidth: 32, alignment: .center)
                .contentTransition(.numericText())
                .animation(.spring(response: 0.3), value: count)

            Button(action: {
                count += 1
                WKInterfaceDevice.current().play(.click)
            }) {
                Image(systemName: "plus.circle.fill")
                    .foregroundColor(color)
                    .font(.title3)
            }
            .buttonStyle(.plain)
        }
    }
}
