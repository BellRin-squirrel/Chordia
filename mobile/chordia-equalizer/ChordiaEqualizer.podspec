require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ChordiaEqualizer'
  s.version        = package['version']
  s.summary        = 'Chordia Native Equalizer Module'
  s.description    = 'Native Equalizer DSP module for Chordia Mobile'
  s.license        = 'MIT'
  s.author         = 'Chordia'
  s.homepage       = 'https://github.com/BellRin-squirrel/Chordia'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.0'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift}"
end