//! Kernels for the living CV, exported to JavaScript as a plain C ABI over WebAssembly memory.
//!
//! Each kernel is an opaque handle created by `*_new`. JavaScript calls `*_step` each frame (or
//! whenever inputs change) and reads results through `Float32Array` views at the returned
//! pointers. No bindings generator is needed: see `src/kernel/wasm.ts` for the other side.

pub mod fft;
pub mod field;
pub mod neural;
pub mod rng;

use field::{Centre, Field, Frame};
use neural::Neural;

/// Reclaims ownership of a handle for the duration of a call.
///
/// # Safety
/// `h` must come from the matching `*_new` and not have been freed.
unsafe fn handle<'a, T>(h: *mut T) -> &'a mut T {
    &mut *h
}

// ---- neural ---------------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn neural_new(seed: u32) -> *mut Neural {
    Box::into_raw(Box::new(Neural::new(seed)))
}

/// # Safety
/// `h` must be a live handle from `neural_new`.
#[no_mangle]
pub unsafe extern "C" fn neural_step(h: *mut Neural, beta_gain: f32, spike_rate: f32) {
    handle(h).step(beta_gain, spike_rate);
}

#[no_mangle]
pub extern "C" fn neural_len() -> u32 {
    neural::N as u32
}

#[no_mangle]
pub extern "C" fn neural_bins() -> u32 {
    neural::BINS as u32
}

/// # Safety
/// `h` must be a live handle from `neural_new`.
#[no_mangle]
pub unsafe extern "C" fn neural_signal(h: *mut Neural) -> *const f32 {
    handle(h).signal.as_ptr()
}

/// # Safety
/// `h` must be a live handle from `neural_new`.
#[no_mangle]
pub unsafe extern "C" fn neural_freqs(h: *mut Neural) -> *const f32 {
    handle(h).freqs.as_ptr()
}

/// # Safety
/// `h` must be a live handle from `neural_new`.
#[no_mangle]
pub unsafe extern "C" fn neural_power(h: *mut Neural) -> *const f32 {
    handle(h).power.as_ptr()
}

/// # Safety
/// `h` must be a live handle from `neural_new`.
#[no_mangle]
pub unsafe extern "C" fn neural_aperiodic(h: *mut Neural) -> *const f32 {
    handle(h).aperiodic.as_ptr()
}

/// Six floats: offset, exponent, peak Hz, peak height, peak width, R².
///
/// # Safety
/// `h` must be a live handle from `neural_new`.
#[no_mangle]
pub unsafe extern "C" fn neural_fit(h: *mut Neural) -> *const f32 {
    &handle(h).fit as *const neural::Fit as *const f32
}

/// Band-pass the current window into slot 0 or 1.
///
/// # Safety
/// `h` must be a live handle from `neural_new`.
#[no_mangle]
pub unsafe extern "C" fn neural_band(h: *mut Neural, slot: u32, lo: f32, hi: f32) {
    handle(h).band_pass(slot as usize, lo, hi);
}

/// # Safety
/// `h` must be a live handle from `neural_new`.
#[no_mangle]
pub unsafe extern "C" fn neural_band_signal(h: *mut Neural, slot: u32) -> *const f32 {
    handle(h).band[(slot as usize).min(1)].as_ptr()
}

/// # Safety
/// `h` must be a live handle from `neural_new`.
#[no_mangle]
pub unsafe extern "C" fn neural_band_envelope(h: *mut Neural, slot: u32) -> *const f32 {
    handle(h).envelope[(slot as usize).min(1)].as_ptr()
}

// ---- field ----------------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn field_new(n: u32) -> *mut Field {
    Box::into_raw(Box::new(Field::new(n as usize)))
}

/// # Safety
/// `h` must be a live handle from `field_new`.
#[no_mangle]
pub unsafe extern "C" fn field_centre(h: *mut Field, i: u32, x: f64, y: f64, r: f64) {
    if let Some(c) = handle(h).centres.get_mut(i as usize) {
        *c = Centre { x, y, r };
    }
}

/// # Safety
/// `h` must be a live handle from `field_new`.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub unsafe extern "C" fn field_step(h: *mut Field, n: u32, t: f64, x: f64, y: f64, w: f64, hgt: f64, membrane_y: f64, membrane: f64, cluster: f64) {
    let frame = Frame { t, x, y, w, h: hgt, membrane_y, membrane, cluster };
    handle(h).step(&frame, n as usize);
}

/// # Safety
/// `h` must be a live handle from `field_new`.
#[no_mangle]
pub unsafe extern "C" fn field_out(h: *mut Field) -> *const f32 {
    handle(h).out.as_ptr()
}

#[no_mangle]
pub extern "C" fn field_stride() -> u32 {
    field::STRIDE as u32
}
