import SwiftUI

@main
struct MtcCounterWatchApp: App {
    @StateObject private var appState = WatchAppState()

    var body: some Scene {
        WindowGroup {
            WatchContentView()
                .environmentObject(appState)
        }
    }
}
