/**
 * Tag cache của tin sách cũ (trang công khai ở vòng 9 gắn các tag này): danh sách chợ, một tin, các bản cũ của một
 * cuốn sách ("Có N bản cũ" ở trang sách). Tin đang công khai đổi (sửa → về chờ duyệt, rút, duyệt, gỡ) → updateTag
 * từng tag.
 */
export function usedListingTags(listingId: number, bookId: number) {
  return ['used-listings', `used-listing:${listingId}`, `used-book:${bookId}`]
}
