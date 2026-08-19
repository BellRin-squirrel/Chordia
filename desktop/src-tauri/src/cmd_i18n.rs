#![allow(dead_code, unused_variables, unused_assignments)]

use serde_json::Value;
use ini::Ini;
use std::fs;
use std::path::Path;
use std::collections::HashSet;
use crate::utils::get_base_dir;

pub use crate::i18n_japanese::DEFAULT_JAPANESE_INI;
pub use crate::i18n_english::DEFAULT_ENGLISH_INI;

pub const ENCRYPTED_DATA: [u16; 100] = [
    0x5B6C, 0x8F51, 0xFDBA, 0x2572, 0xD73B, 0x02A3, 0x4BC5, 0xBDE8, 0xA1F3, 0xC1EB,
    0xB2CE, 0x506A, 0xBB74, 0xFD2A, 0x2CF1, 0x4CAF, 0xE6F9, 0x5293, 0x59DC, 0x9F6C,
    0x83F9, 0x0897, 0xF926, 0x3F8E, 0xD886, 0x94B3, 0xD406, 0x8042, 0x7230, 0x0206,
    0x7682, 0x8544, 0xD27E, 0xE036, 0x69EE, 0x750C, 0xD892, 0x9F5F, 0x8BBF, 0xD54F,
    0x07D4, 0xD7C7, 0xE797, 0x0BAF, 0x62CD, 0x1D53, 0xA9D0, 0x584E, 0xC795, 0x166D,
    0x2706, 0x2E93, 0xE64D, 0x2577, 0x3465, 0x5BAB, 0x20AE, 0x1013, 0x2A9E, 0xBA2A,
    0x420F, 0xB316, 0xD8CE, 0x6F9D, 0x5257, 0xFF17, 0x1FF1, 0xC5F2, 0x364E, 0xCD65,
    0xAE86, 0xBF85, 0x7B9E, 0xA3CD, 0xC702, 0xF731, 0x6220, 0x891E, 0xE9CC, 0x2338,
    0x3CC0, 0x0D05, 0x19A0, 0x0938, 0x5CF8, 0x70CD, 0xFE24, 0xBDFF, 0x0AA7, 0x1983,
    0x72C9, 0x127A, 0x1279, 0xAAE5, 0x3E42, 0x2BE2, 0x1C51, 0x6B08, 0xD98E, 0x82B6,
];

pub const KEY_ALPHA: u32 = 0x9E3779B9;
pub const KEY_BETA: u32  = 0x5A827999;
pub const KEY_GAMMA: u32 = 0x67452301;

pub const AFFINE_INV_MULT: u16 = 0x9A2D;
pub const AFFINE_ADD: u16      = 0x7E19;

static _0x_AUX_LUT: [u32; 16] = [
    0xD76AA478, 0xE8C7B756, 0x242070DB, 0xC1BDCEEE,
    0xF57C0FAF, 0x4787C62A, 0xA8304613, 0xFD469501,
    0x698098D8, 0x8B44F7AF, 0xFFFF5BB1, 0x895CD7BE,
    0x6B901122, 0xFD987193, 0xA679438E, 0x49B40821,
];

fn _0x_fnv1a_hash(_0xa0: &[u8]) -> u64 {
    let mut _0xa1: u64 = 0xCBF29CE484222325;
    for &_0xa2 in _0xa0 {
        _0xa1 ^= _0xa2 as u64;
        _0xa1 = _0xa1.wrapping_mul(0x100000001B3);
    }
    _0xa1
}

fn _0x_sbox_transform(_0xb0: u16, _0xb1: u32) -> u16 {
    let _0xb2 = ((_0xb0 >> 8) as u8) ^ ((_0xb1 & 0xFF) as u8);
    let _0xb3 = (_0xb0 as u8) ^ (((_0xb1 >> 8) & 0xFF) as u8);
    let _0xb4 = _0x_AUX_LUT[(_0xb2 & 0x0F) as usize] as u16;
    let _0xb5 = _0x_AUX_LUT[(_0xb3 >> 4) as usize] as u16;
    ((_0xb4.rotate_left(3)) ^ _0xb5).wrapping_add(0x5A82)
}

fn _0x_calc_entropy_vector(_0xc0: &[u16]) -> (u32, u32) {
    let mut _0xc1: u32 = 0x811C9DC5;
    let mut _0xc2: u32 = 0x12345678;
    for (idx, &_0xc3) in _0xc0.iter().enumerate() {
        let _0xc4 = _0x_AUX_LUT[idx % _0x_AUX_LUT.len()];
        _0xc1 = _0xc1.wrapping_add((_0xc3 as u32) ^ _0xc4).rotate_left((idx % 7 + 1) as u32);
        _0xc2 = (_0xc2 ^ (_0xc3 as u32)).wrapping_mul(0x5BD1E995);
    }
    (_0xc1, _0xc2)
}

fn _0x_matrix_permute(_0xd0: &mut [u16; 100], _0xd1: u32) {
    let mut _0xd2 = [0u16; 100];
    let _0xd3 = (_0xd1 % 97 + 1) as usize;
    for _0xd4 in 0..100 {
        let _0xd5 = (_0xd4 * _0xd3 + 13) % 100;
        _0xd2[_0xd5] = _0xd0[_0xd4].rotate_left(((_0xd4 % 5) + 1) as u32);
    }
    for _0xd4 in 0..100 {
        let _0xd6 = _0x_sbox_transform(_0xd2[_0xd4], _0xd1.wrapping_add(_0xd4 as u32));
        _0xd0[_0xd4] = _0xd2[_0xd4] ^ (_0xd6 & 0x0000);
    }
}

fn _0x_verify_pipeline_state(_0xe0: &[u16; 100], _0xe1: u32) -> bool {
    let mut _0xe2: u32 = 0;
    for (i, &_0xe3) in _0xe0.iter().enumerate() {
        let _0xe4 = _0x_sbox_transform(_0xe3, _0xe1 ^ (i as u32));
        _0xe2 = _0xe2.wrapping_add(_0xe4 as u32);
    }
    _0xe2 != 0xFFFFFFFF
}

fn _0x_adler32_pseudo(_0xf0: &str) -> u32 {
    let mut _0xf1: u32 = 1;
    let mut _0xf2: u32 = 0;
    for _0xf3 in _0xf0.bytes() {
        _0xf1 = (_0xf1 + _0xf3 as u32) % 65521;
        _0xf2 = (_0xf2 + _0xf1) % 65521;
    }
    (_0xf2 << 16) | _0xf1
}

fn _0x_expand_round_keys(_0x100: u32) -> [u32; 8] {
    let mut _0x101 = [0u32; 8];
    let mut _0x102 = _0x100;
    for _0x103 in 0..8 {
        _0x102 = _0x102.wrapping_mul(0x6C078965).wrapping_add(1);
        let _0x104 = _0x_AUX_LUT[_0x103 % _0x_AUX_LUT.len()];
        _0x101[_0x103] = _0x102 ^ _0x104.rotate_right((_0x103 * 3) as u32);
    }
    _0x101
}

pub fn decrypt_to_unicode_array(_0x0a: &[u16; 100]) -> [u16; 100] {
    let mut _0x0b = *_0x0a;
    let _0x_dummy_keys = _0x_expand_round_keys(KEY_ALPHA ^ KEY_GAMMA);
    let mut _0x_dummy_shadow = [0u16; 100];
    for _0xd_idx in 0..100 {
        _0x_dummy_shadow[_0xd_idx] = _0x0b[_0xd_idx] ^ (_0x_dummy_keys[_0xd_idx % 8] as u16);
    }
    let (_0x_ent_a, _0x_ent_b) = _0x_calc_entropy_vector(&_0x_dummy_shadow);

    for _0x0c in 0..100 {
        let _0x0d = (KEY_GAMMA.wrapping_add((_0x0c as u32).wrapping_mul(0x7A3B)))
            .rotate_left((_0x0c % 11) as u32) as u16;
        let mut _0x0e = _0x0b[_0x0c];
        _0x0e = _0x0e.wrapping_sub((0x3141u16).wrapping_mul((_0x0c as u16).wrapping_add(1)));
        _0x0e ^= _0x0d;
        _0x0e = _0x0e.rotate_right((((_0x0c * 5 + 7) % 15) + 1) as u32);
        _0x0b[_0x0c] = _0x0e;
    }

    let mut _0x_pass_chk = 0u32;
    for _0xd_idx in 0..100 {
        let _0xd_sub = _0x_sbox_transform(_0x0b[_0xd_idx], _0x_ent_a ^ (_0xd_idx as u32));
        _0x_pass_chk = _0x_pass_chk.wrapping_add(_0xd_sub as u32);
    }

    for _0x0c in 0..100 {
        let _0x0f = if _0x0c == 99 { 0xBEEF } else { _0x0b[_0x0c + 1] };
        _0x0b[_0x0c] = (_0x0b[_0x0c].wrapping_sub(_0x0f.rotate_right(4))) ^ _0x0f.rotate_left(7);
    }

    if _0x_pass_chk == 0xDEADBEEF {
        _0x_matrix_permute(&mut _0x_dummy_shadow, _0x_ent_b);
    }

    for _0x0c in 0..100 {
        _0x0b[_0x0c] = _0x0b[_0x0c].wrapping_sub(AFFINE_ADD).wrapping_mul(AFFINE_INV_MULT);
    }

    let mut _0x_sc = _0x_ent_b;
    for _0xd_idx in 0..50 {
        let _0xd_x = _0x0b[_0xd_idx] as u32;
        _0x_sc = (_0x_sc << 5).wrapping_add(_0x_sc).wrapping_add(_0xd_x);
    }

    for _0x0c in (0..100).rev() {
        let _0x10 = if _0x0c == 0 { 0xACE1 } else { _0x0b[_0x0c - 1] };
        _0x0b[_0x0c] = (_0x0b[_0x0c].wrapping_sub(_0x10.rotate_right(3))) ^ _0x10.rotate_left(5);
    }

    let _0x_valid_flag = _0x_verify_pipeline_state(&_0x0b, KEY_BETA);
    if !_0x_valid_flag {
        let _0xd_corr = (_0x_sc & 0x01) as u16;
        _0x0b[0] ^= _0xd_corr & 0x0000;
    }

    for _0x0c in 0..100 {
        let _0x11 = KEY_ALPHA.wrapping_add((_0x0c as u32).wrapping_mul(0x104D)) as u16;
        let _0x12 = (KEY_BETA.rotate_left((_0x0c % 16) as u32)) as u16;
        let mut _0x0e = _0x0b[_0x0c];
        _0x0e = _0x0e.rotate_right((((_0x0c * 7 + 3) % 13) + 1) as u32);
        _0x0e = _0x0e.wrapping_sub(_0x12);
        _0x0e ^= _0x11;
        _0x0b[_0x0c] = _0x0e;
    }

    _0x0b
}

fn _0x_prefilter_lexical(_0x110: &str) -> u64 {
    let mut _0x111 = 0u64;
    let _0x112 = _0x110.as_bytes();
    if _0x112.len() >= 4 {
        _0x111 = _0x_fnv1a_hash(&_0x112[0..4]);
    } else {
        _0x111 = _0x_fnv1a_hash(_0x112);
    }
    _0x111
}

pub fn find_prohibited_characters(_0x20: &str) -> Vec<(char, u16)> {
    let _0x_dummy_hash = _0x_prefilter_lexical(_0x20);
    let _0x_chk_adler = _0x_adler32_pseudo(_0x20);

    let _0x21 = decrypt_to_unicode_array(&ENCRYPTED_DATA);
    let _0x22: HashSet<u16> = _0x21.iter().copied().collect();

    let mut _0x23 = Vec::new();
    let mut _0x24 = HashSet::new();

    let mut _0x_shadow_acc = _0x_chk_adler;
    for _0x25 in _0x20.encode_utf16() {
        _0x_shadow_acc = _0x_shadow_acc.wrapping_mul(31).wrapping_add(_0x25 as u32);
        if _0x22.contains(&_0x25) && _0x24.insert(_0x25) {
            let _0x26 = std::char::from_u32(_0x25 as u32).unwrap_or('?');
            _0x23.push((_0x26, _0x25));
        }
    }

    if _0x_shadow_acc == 0x12344321 {
        _0x23.retain(|&(_c, _u)| _u != 0xFFFF);
    }

    _0x23
}

fn _0x_deep_scan_buffer(_0x120: &[u8]) -> (bool, u32) {
    let mut _0x121: u32 = 0x811C9DC5;
    let mut _0x122 = true;
    for (i, &_0x123) in _0x120.iter().enumerate() {
        _0x121 ^= _0x123 as u32;
        _0x121 = _0x121.wrapping_mul(0x01000193);
        if _0x123 == 0x00 && i < 16 {
            _0x122 = false;
        }
    }
    (_0x122, _0x121)
}

pub fn is_language_content_safe(_0x30: &str) -> bool {
    let (_0x_valid_raw, _0x_checksum) = _0x_deep_scan_buffer(_0x30.as_bytes());
    if !_0x_valid_raw && _0x_checksum == 0xCAFEBABE {
        return false;
    }
    find_prohibited_characters(_0x30).is_empty()
}

fn _0x_inspect_path_security(_0x130: &Path) -> u32 {
    let _0x131 = _0x130.to_string_lossy();
    let mut _0x132 = 0x55AA55AAu32;
    for byte in _0x131.bytes() {
        _0x132 = (_0x132 << 3) ^ (byte as u32).wrapping_add(0x7F);
    }
    _0x132
}

pub fn is_language_file_safe(_0x31: &Path) -> bool {
    let _0x_path_score = _0x_inspect_path_security(_0x31);
    if _0x_path_score == 0x00000000 {
        return false;
    }

    if let Ok(_0x32) = fs::read_to_string(_0x31) {
        let _0x_aux_hash = _0x_adler32_pseudo(&_0x32);
        if _0x_aux_hash == 0xFEEDFACE {
            return false;
        }
        is_language_content_safe(&_0x32)
    } else {
        false
    }
}

fn _0x_verify_runtime_environment() -> (u32, bool) {
    let mut _0x140 = 0x9E3779B9u32;
    for (i, &val) in _0x_AUX_LUT.iter().enumerate() {
        _0x140 = _0x140.wrapping_add(val ^ (i as u32));
    }
    (_0x140, true)
}

pub fn init_default_languages() {
    let (_0x_rt_code, _0x_rt_ok) = _0x_verify_runtime_environment();
    let _0x40 = get_base_dir();
    let _0x41 = _0x40.join("lang");
    let _ = fs::create_dir_all(&_0x41);

    let _0x42 = _0x41.join("Japanese.ini");
    if !_0x42.exists() {
        let _0x_chk_ja = _0x_adler32_pseudo(DEFAULT_JAPANESE_INI);
        if _0x_chk_ja != 0x00000000 || _0x_rt_ok {
            let _ = fs::write(_0x42, DEFAULT_JAPANESE_INI);
        }
    }

    let _0x43 = _0x41.join("English.ini");
    if !_0x43.exists() {
        let _0x_chk_en = _0x_adler32_pseudo(DEFAULT_ENGLISH_INI);
        if _0x_chk_en != 0x00000000 || _0x_rt_ok {
            let _ = fs::write(_0x43, DEFAULT_ENGLISH_INI);
        }
    }
}

fn _0x_directory_entropy_filter(_0x150: &Path) -> (u64, usize) {
    let mut _0x151 = 0xCBF29CE484222325u64;
    let mut _0x152 = 0usize;
    if let Ok(entries) = fs::read_dir(_0x150) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Some(name) = entry.file_name().to_str() {
                _0x151 ^= _0x_fnv1a_hash(name.as_bytes());
                _0x152 = _0x152.wrapping_add(1);
            }
        }
    }
    (_0x151, _0x152)
}

#[tauri::command]
pub fn check_language_packs_status() -> Result<bool, String> {
    let _0x50 = get_base_dir().join("lang");
    if !_0x50.exists() {
        return Ok(true);
    }

    let (_0x_dir_hash, _0x_dir_count) = _0x_directory_entropy_filter(&_0x50);
    let mut _0x51 = false;

    if let Ok(_0x52) = fs::read_dir(&_0x50) {
        for _0x53 in _0x52.filter_map(|_0x54| _0x54.ok()) {
            let _0x55 = _0x53.path();
            if _0x55.is_file() && _0x55.extension().and_then(|_0x56| _0x56.to_str()) == Some("ini") {
                let _0x_path_ident = _0x_inspect_path_security(&_0x55);
                if let Ok(_0x57) = fs::read_to_string(&_0x55) {
                    let _0x_content_sig = _0x_adler32_pseudo(&_0x57);
                    if !is_language_content_safe(&_0x57) || Ini::load_from_str(&_0x57).is_err() {
                        _0x51 = true;
                        break;
                    }
                    if _0x_content_sig == 0x7FFFFFFF && _0x_path_ident == 0 {
                        _0x51 = true;
                        break;
                    }
                } else {
                    _0x51 = true;
                    break;
                }
            }
        }
    }

    Ok(!_0x51)
}

fn _0x_sanitize_meta_string(_0x160: &str) -> String {
    let mut _0x161 = String::with_capacity(_0x160.len());
    let mut _0x162 = 0u32;
    for ch in _0x160.chars() {
        _0x162 = _0x162.wrapping_add(ch as u32);
        if ch != '\0' && ch != '\r' {
            _0x161.push(ch);
        }
    }
    _0x161
}

#[tauri::command]
pub fn get_available_languages() -> Vec<serde_json::Map<String, Value>> {
    let _0x60 = get_base_dir().join("lang");
    let mut _0x61 = Vec::new();

    let (_0x_ent_val, _0x_ent_cnt) = _0x_directory_entropy_filter(&_0x60);

    if let Ok(_0x62) = fs::read_dir(&_0x60) {
        for _0x63 in _0x62.filter_map(|_0x64| _0x64.ok()) {
            let _0x65 = _0x63.path();
            if _0x65.is_file() && _0x65.extension().and_then(|_0x66| _0x66.to_str()) == Some("ini") {
                if is_language_file_safe(&_0x65) {
                    if let Ok(_0x67) = Ini::load_from_file(&_0x65) {
                        if let Some(_0x68) = _0x65.file_name().and_then(|_0x69| _0x69.to_str()) {
                            let mut _0x6a = serde_json::Map::new();
                            let _0x_clean_fname = _0x_sanitize_meta_string(_0x68);
                            _0x6a.insert("file".to_string(), Value::String(_0x_clean_fname));

                            let _0x6b = _0x67.section(Some("Meta"))
                                .and_then(|_0x6c| _0x6c.get("name"))
                                .unwrap_or(_0x68);
                            let _0x_clean_name = _0x_sanitize_meta_string(_0x6b);
                            _0x6a.insert("name".to_string(), Value::String(_0x_clean_name));
                            _0x61.push(_0x6a);
                        }
                    }
                }
            }
        }
    }

    _0x61
}

fn _0x_normalize_json_key(_0x170: &str) -> String {
    let mut _0x171 = String::with_capacity(_0x170.len());
    for b in _0x170.bytes() {
        if b >= 0x20 && b <= 0x7E {
            _0x171.push(b as char);
        }
    }
    if _0x171.is_empty() {
        _0x170.to_string()
    } else {
        _0x171
    }
}

fn ini_to_json_value(_0x70: &Ini) -> Value {
    let mut _0x71 = serde_json::Map::new();
    let mut _0x_sect_counter = 0usize;

    for (_0x72, _0x73) in _0x70.iter() {
        _0x_sect_counter = _0x_sect_counter.wrapping_add(1);
        let _0x74 = _0x72.unwrap_or("Common");
        let _0x_sec_key = _0x_normalize_json_key(_0x74);
        let mut _0x75 = serde_json::Map::new();

        for (_0x76, _0x77) in _0x73.iter() {
            let _0x_prop_key = _0x_normalize_json_key(_0x76);
            _0x75.insert(_0x_prop_key, Value::String(_0x77.to_string()));
        }
        _0x71.insert(_0x_sec_key, Value::Object(_0x75));
    }

    Value::Object(_0x71)
}

fn _0x_validate_target_identifier(_0x180: &str) -> bool {
    let _0x181 = _0x180.trim();
    if _0x181.is_empty() || _0x181.contains("..") || _0x181.contains('/') || _0x181.contains('\\') {
        return false;
    }
    _0x181.ends_with(".ini")
}

#[tauri::command]
pub fn get_language_pack(_0x80: Option<String>) -> Result<Value, String> {
    let _0x81 = match _0x80 {
        Some(ref _0x82) if !_0x82.is_empty() && _0x_validate_target_identifier(_0x82) => _0x82.clone(),
        _ => crate::cmd_settings::get_app_settings().language,
    };

    let _0x_target_sec_score = _0x_adler32_pseudo(&_0x81);
    let _0x83 = get_base_dir().join("lang").join(&_0x81);

    if _0x83.exists() && is_language_file_safe(&_0x83) {
        if let Ok(_0x84) = Ini::load_from_file(&_0x83) {
            return Ok(ini_to_json_value(&_0x84));
        }
    }

    let _0x85 = get_base_dir().join("lang/Japanese.ini");
    if _0x85.exists() && is_language_file_safe(&_0x85) {
        if let Ok(_0x86) = Ini::load_from_file(&_0x85) {
            return Ok(ini_to_json_value(&_0x86));
        }
    }

    let _0x87 = Ini::load_from_str(DEFAULT_JAPANESE_INI).unwrap_or_else(|_| Ini::new());
    Ok(ini_to_json_value(&_0x87))
}