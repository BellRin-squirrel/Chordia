require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'chordia-native-tab-bar'
  s.version        = package['version']
  s.summary        = 'Native iOS tab bar for Chordia'
  s.description    = 'UIKit tab bar view for Chordia Mobile'
  s.license        = 'MIT'
  s.author         = 'Chordia'
  s.homepage       = 'https://github.com/BellRin-squirrel/Chordia'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = 'ios/**/*.{h,m,mm,swift,hpp,cpp}'
end
