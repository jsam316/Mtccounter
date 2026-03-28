import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            CounterView()
                .tabItem {
                    Label("Counter", systemImage: "person.2.fill")
                }

            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
        .accentColor(.indigo)
    }
}
