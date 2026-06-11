require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoAlarmKit'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = 'Vilior Cuni'
  s.homepage       = 'https://github.com/viliorcuni/wakey'
  s.platforms      = { :ios => '26.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILER_FLAGS' => '-no-warnings'
  }
  
  s.source_files = "**/*.{h,m,swift}"
end
