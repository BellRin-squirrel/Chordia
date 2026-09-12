Pod::Spec.new do |s|
  s.name           = "ChordiaEqualizer"
  s.version        = "0.1.0"
  s.summary        = "Chordia Equalizer Module"
  s.description    = "Native Equalizer DSP module for Chordia Mobile"
  s.license        = "MIT"
  s.author         = "Chordia"
  s.homepage       = "https://github.com/BellRin-squirrel/Chordia"
  s.platforms      = { :ios => "15.1" }
  s.swift_version  = "5.0"
  s.source         = { :git => "" }
  s.static_framework = true

  s.dependency "ExpoModulesCore"

  s.source_files = "**/*.swift"
end