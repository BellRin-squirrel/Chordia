import ExpoModulesCore
import UIKit

public final class ChordiaNativeTabBarView: ExpoView, UITabBarDelegate {
  let onTabSelected = EventDispatcher()

  private let tabBar = UITabBar()
  private var selectedKey: String?

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    tabBar.translatesAutoresizingMaskIntoConstraints = false
    tabBar.delegate = self
    addSubview(tabBar)

    NSLayoutConstraint.activate([
      tabBar.leadingAnchor.constraint(equalTo: leadingAnchor),
      tabBar.trailingAnchor.constraint(equalTo: trailingAnchor),
      tabBar.topAnchor.constraint(equalTo: topAnchor),
      tabBar.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
  }

  func setTabs(_ tabs: [[String: String]]) {
    tabBar.items = tabs.map { tab in
      let item = UITabBarItem(
        title: tab["title"],
        image: tab["icon"].flatMap { UIImage(systemName: $0) },
        selectedImage: tab["selectedIcon"].flatMap { UIImage(systemName: $0) }
      )
      item.accessibilityIdentifier = tab["key"]
      return item
    }
    updateSelectedItem()
  }

  func setSelectedKey(_ key: String?) {
    selectedKey = key
    updateSelectedItem()
  }

  func setTabTintColor(_ color: UIColor?) {
    tabBar.tintColor = color
  }

  func setUnselectedTintColor(_ color: UIColor?) {
    tabBar.unselectedItemTintColor = color
  }

  private func updateSelectedItem() {
    guard let selectedKey else { return }
    tabBar.selectedItem = tabBar.items?.first {
      $0.accessibilityIdentifier == selectedKey
    }
  }

  public func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
    guard let key = item.accessibilityIdentifier else { return }
    selectedKey = key
    onTabSelected(["key": key])
  }
}

public final class ChordiaNativeTabBarModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ChordiaNativeTabBar")

    View(ChordiaNativeTabBarView.self) {
      Events("onTabSelected")

      Prop("tabs") { (view, tabs: [[String: String]]?) in
        view.setTabs(tabs ?? [])
      }

      Prop("selectedKey") { (view, key: String?) in
        view.setSelectedKey(key)
      }

      Prop("tintColor") { (view, color: UIColor?) in
        view.setTabTintColor(color)
      }

      Prop("unselectedTintColor") { (view, color: UIColor?) in
        view.setUnselectedTintColor(color)
      }
    }
  }
}
