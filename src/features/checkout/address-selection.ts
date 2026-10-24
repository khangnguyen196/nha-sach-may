/**
 * Địa chỉ chọn sẵn ở /thanh-toan và trang mua sách cũ: `?address=` (vừa thêm từ trang thêm địa chỉ) nếu thuộc sổ địa
 * chỉ của người đang đặt, không thì địa chỉ đầu danh sách (getAddresses xếp mặc định lên đầu); sổ trống → undefined.
 */
export function pickAddressId(addresses: readonly { id: number }[], raw: string | string[] | undefined) {
  const wanted = Number(raw)
  return addresses.find((address) => address.id === wanted)?.id ?? addresses[0]?.id
}
