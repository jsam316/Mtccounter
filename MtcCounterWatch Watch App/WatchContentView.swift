import SwiftUI

struct WatchContentView: View {
    var body: some View {
        TabView {
            WatchCounterView()
            WatchRoundsView()
        }
        .tabViewStyle(.page)
    }
}
