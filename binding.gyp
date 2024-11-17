{
    "targets": [
        {
            "include_dirs": [
                "<!(node -e \"require('nan')\")"
            ],
            "cflags_cc": [
               "-O3"
            ],
            "xcode_settings": {
                "CLANG_CXX_LANGUAGE_STANDARD": "c++11",
                "CLANG_CXX_LIBRARY": "libc++",
                "MACOSX_DEPLOYMENT_TARGET": "10.7",
                "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
                "GCC_ENABLE_CPP_RTTI": "YES",
                "OTHER_CPLUSPLUSFLAGS": [
                    "-O3"
                ]
            },
            "libraries": [
                
            ],
            "target_name": "addon",
            "sources": [
                "./src/native/main.cpp",
                "./src/native/deviceinfo.cpp",
                "./src/native/devicecontrol.cpp",
                "./src/native/ipforward_entry.cpp",
                "./src/native/create_device_file.cpp",
                "./src/native/rwevent_process.cpp"
            ]
        }
    ]
}