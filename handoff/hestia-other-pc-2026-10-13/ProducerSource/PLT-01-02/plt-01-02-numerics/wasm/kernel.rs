#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo<'_>) -> ! {
    core::arch::wasm32::unreachable()
}

#[no_mangle]
pub extern "C" fn add_u32(lhs: u32, rhs: u32) -> u32 {
    lhs.wrapping_add(rhs)
}

#[cfg(not(simd))]
unsafe fn add_four_inner(lhs: *const u32, rhs: *const u32, out: *mut u32) {
    let lhs = unsafe { lhs.cast::<[u32; 4]>().read_unaligned() };
    let rhs = unsafe { rhs.cast::<[u32; 4]>().read_unaligned() };

    for index in 0..4 {
        unsafe { out.add(index).write_unaligned(lhs[index].wrapping_add(rhs[index])) };
    }
}

#[cfg(simd)]
#[target_feature(enable = "simd128")]
unsafe fn add_four_inner(lhs: *const u32, rhs: *const u32, out: *mut u32) {
    use core::arch::wasm32::{i32x4_add, v128_load, v128_store};

    let lhs = unsafe { v128_load(lhs.cast()) };
    let rhs = unsafe { v128_load(rhs.cast()) };
    unsafe { v128_store(out.cast(), i32x4_add(lhs, rhs)) };
}

/// Adds four pairs of `u32` values with wrapping arithmetic.
///
/// # Safety
/// `lhs` and `rhs` must each address 16 initialized bytes, and `out` 16 writable
/// bytes, all within this module's linear memory. No alignment is required.
/// Input and output ranges may overlap; both inputs are read before any output
/// is written.
#[no_mangle]
pub unsafe extern "C" fn add_four(lhs: *const u32, rhs: *const u32, out: *mut u32) {
    unsafe { add_four_inner(lhs, rhs, out) };
}
