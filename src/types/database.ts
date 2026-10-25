
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "addresses": {
                  Row: {
                    "created_at": string,"id": number,"is_default": boolean,"phone": string,"province": string,"recipient_name": string,"street": string,"user_id": string,"ward": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: number,"is_default"?: boolean,"phone": string,"province": string,"recipient_name": string,"street": string,"user_id": string,"ward": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: number,"is_default"?: boolean,"phone"?: string,"province"?: string,"recipient_name"?: string,"street"?: string,"user_id"?: string,"ward"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "addresses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"authors": {
                  Row: {
                    "bio": string | null,"bio_en": string | null,"created_at": string,"id": number,"name": string,"photo_url": string | null,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"bio_en"?: string | null,"created_at"?: string,"id"?: number,"name": string,"photo_url"?: string | null,"slug": string
                  }
                  Update: {
                    "bio"?: string | null,"bio_en"?: string | null,"created_at"?: string,"id"?: number,"name"?: string,"photo_url"?: string | null,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"book_authors": {
                  Row: {
                    "author_id": number,"book_id": number,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": number,"book_id": number,"role"?: string
                  }
                  Update: {
                    "author_id"?: number,"book_id"?: number,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "book_authors_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "authors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_authors_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    }
                  ]
                },"book_images": {
                  Row: {
                    "book_id": number,"id": number,"sort_order": number,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": number,"id"?: number,"sort_order"?: number,"url": string
                  }
                  Update: {
                    "book_id"?: number,"id"?: number,"sort_order"?: number,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "book_images_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    }
                  ]
                },"books": {
                  Row: {
                    "avg_rating": number,"category_id": number | null,"content_warnings": (Database["public"]['Enums']["content_warning"])[],"content_warnings_reviewed_at": string | null,"cover_url": string | null,"cover_width": number | null,"created_at": string,"description": string | null,"description_en": string | null,"dimensions": string | null,"format": Database["public"]['Enums']["book_format"],"id": number,"is_active": boolean,"is_featured": boolean,"isbn": string | null,"language": string,"original_price": number | null,"page_count": number | null,"price": number,"published_year": number | null,"publisher_id": number | null,"review_count": number,"search_text": string | null,"slug": string,"sold_count": number,"stock": number,"subtitle": string | null,"title": string,"updated_at": string,"weight_grams": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_rating"?: number,"category_id"?: number | null,"content_warnings"?: (Database["public"]['Enums']["content_warning"])[],"content_warnings_reviewed_at"?: string | null,"cover_url"?: string | null,"cover_width"?: number | null,"created_at"?: string,"description"?: string | null,"description_en"?: string | null,"dimensions"?: string | null,"format"?: Database["public"]['Enums']["book_format"],"id"?: number,"is_active"?: boolean,"is_featured"?: boolean,"isbn"?: string | null,"language"?: string,"original_price"?: number | null,"page_count"?: number | null,"price": number,"published_year"?: number | null,"publisher_id"?: number | null,"review_count"?: number,"search_text"?: string | null,"slug": string,"sold_count"?: number,"stock"?: number,"subtitle"?: string | null,"title": string,"updated_at"?: string,"weight_grams"?: number | null
                  }
                  Update: {
                    "avg_rating"?: number,"category_id"?: number | null,"content_warnings"?: (Database["public"]['Enums']["content_warning"])[],"content_warnings_reviewed_at"?: string | null,"cover_url"?: string | null,"cover_width"?: number | null,"created_at"?: string,"description"?: string | null,"description_en"?: string | null,"dimensions"?: string | null,"format"?: Database["public"]['Enums']["book_format"],"id"?: number,"is_active"?: boolean,"is_featured"?: boolean,"isbn"?: string | null,"language"?: string,"original_price"?: number | null,"page_count"?: number | null,"price"?: number,"published_year"?: number | null,"publisher_id"?: number | null,"review_count"?: number,"search_text"?: string | null,"slug"?: string,"sold_count"?: number,"stock"?: number,"subtitle"?: string | null,"title"?: string,"updated_at"?: string,"weight_grams"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "books_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "books_publisher_id_fkey"
      columns: ["publisher_id"]
isOneToOne: false
      referencedRelation: "publishers"
      referencedColumns: ["id"]
    }
                  ]
                },"cart_items": {
                  Row: {
                    "book_id": number,"created_at": string,"quantity": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": number,"created_at"?: string,"quantity": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "book_id"?: number,"created_at"?: string,"quantity"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"description_en": string | null,"id": number,"is_active": boolean,"name": string,"name_en": string | null,"parent_id": number | null,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"description_en"?: string | null,"id"?: number,"is_active"?: boolean,"name": string,"name_en"?: string | null,"parent_id"?: number | null,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"description_en"?: string | null,"id"?: number,"is_active"?: boolean,"name"?: string,"name_en"?: string | null,"parent_id"?: number | null,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"content_warning_suggestions": {
                  Row: {
                    "book_id": number,"created_at": string,"id": number,"labels": (Database["public"]['Enums']["content_warning"])[],"model": string | null,"reason": string,"reviewed_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": number,"created_at"?: string,"id"?: number,"labels"?: (Database["public"]['Enums']["content_warning"])[],"model"?: string | null,"reason": string,"reviewed_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "book_id"?: number,"created_at"?: string,"id"?: number,"labels"?: (Database["public"]['Enums']["content_warning"])[],"model"?: string | null,"reason"?: string,"reviewed_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_warning_suggestions_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "book_id": number | null,"cover_url": string | null,"id": number,"line_total": number | null,"order_id": number,"quantity": number,"title": string,"unit_price": number,"used_listing_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id"?: number | null,"cover_url"?: string | null,"id"?: number,"line_total"?: never,"order_id": number,"quantity": number,"title": string,"unit_price": number,"used_listing_id"?: number | null
                  }
                  Update: {
                    "book_id"?: number | null,"cover_url"?: string | null,"id"?: number,"line_total"?: never,"order_id"?: number,"quantity"?: number,"title"?: string,"unit_price"?: number,"used_listing_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_used_listing_id_fkey"
      columns: ["used_listing_id"]
isOneToOne: false
      referencedRelation: "used_listings"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "cancelled_reason": string | null,"created_at": string,"discount": number,"id": number,"idempotency_key": string | null,"note": string | null,"order_code": string,"payment_method": Database["public"]['Enums']["payment_method"],"payment_status": Database["public"]['Enums']["payment_status"],"phone": string,"province": string,"recipient_name": string,"shipping_fee": number,"status": Database["public"]['Enums']["order_status"],"street": string,"subtotal": number,"total": number,"updated_at": string,"user_id": string | null,"voucher_code": string | null,"voucher_id": number | null,"ward": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_reason"?: string | null,"created_at"?: string,"discount"?: number,"id"?: number,"idempotency_key"?: string | null,"note"?: string | null,"order_code"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_status"?: Database["public"]['Enums']["payment_status"],"phone": string,"province": string,"recipient_name": string,"shipping_fee"?: number,"status"?: Database["public"]['Enums']["order_status"],"street": string,"subtotal": number,"total": number,"updated_at"?: string,"user_id"?: string | null,"voucher_code"?: string | null,"voucher_id"?: number | null,"ward": string
                  }
                  Update: {
                    "cancelled_reason"?: string | null,"created_at"?: string,"discount"?: number,"id"?: number,"idempotency_key"?: string | null,"note"?: string | null,"order_code"?: string,"payment_method"?: Database["public"]['Enums']["payment_method"],"payment_status"?: Database["public"]['Enums']["payment_status"],"phone"?: string,"province"?: string,"recipient_name"?: string,"shipping_fee"?: number,"status"?: Database["public"]['Enums']["order_status"],"street"?: string,"subtotal"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string | null,"voucher_code"?: string | null,"voucher_id"?: number | null,"ward"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_voucher_id_fkey"
      columns: ["voucher_id"]
isOneToOne: false
      referencedRelation: "vouchers"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"full_name": string | null,"id": string,"locale": string,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string | null,"id": string,"locale"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string | null,"id"?: string,"locale"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"publishers": {
                  Row: {
                    "created_at": string,"description": string | null,"description_en": string | null,"id": number,"logo_url": string | null,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"description_en"?: string | null,"id"?: number,"logo_url"?: string | null,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"description_en"?: string | null,"id"?: number,"logo_url"?: string | null,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "book_id": number,"content": string | null,"created_at": string,"display_name": string | null,"id": number,"rating": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": number,"content"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: number,"rating": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "book_id"?: number,"content"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: number,"rating"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seller_payouts": {
                  Row: {
                    "amount": number,"created_at": string,"fee": number,"id": number,"listing_id": number,"order_id": number,"paid_at": string | null,"price": number,"seller_id": string,"status": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"fee": number,"id"?: number,"listing_id": number,"order_id": number,"paid_at"?: string | null,"price": number,"seller_id": string,"status"?: string,"title": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"fee"?: number,"id"?: number,"listing_id"?: number,"order_id"?: number,"paid_at"?: string | null,"price"?: number,"seller_id"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seller_payouts_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "used_listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_payouts_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_payouts_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"used_listings": {
                  Row: {
                    "approved_at": string | null,"book_id": number,"condition": Database["public"]['Enums']["used_condition"],"created_at": string,"description": string | null,"fee": number,"id": number,"photos": (string)[],"price": number,"reject_reason": string | null,"seller_id": string,"seller_name": string | null,"status": Database["public"]['Enums']["used_listing_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"book_id": number,"condition": Database["public"]['Enums']["used_condition"],"created_at"?: string,"description"?: string | null,"fee": number,"id"?: number,"photos": (string)[],"price": number,"reject_reason"?: string | null,"seller_id"?: string,"seller_name"?: string | null,"status"?: Database["public"]['Enums']["used_listing_status"],"updated_at"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"book_id"?: number,"condition"?: Database["public"]['Enums']["used_condition"],"created_at"?: string,"description"?: string | null,"fee"?: number,"id"?: number,"photos"?: (string)[],"price"?: number,"reject_reason"?: string | null,"seller_id"?: string,"seller_name"?: string | null,"status"?: Database["public"]['Enums']["used_listing_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "used_listings_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "used_listings_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_blocks": {
                  Row: {
                    "author_id": number | null,"category_id": number | null,"created_at": string,"id": number,"kind": string,"publisher_id": number | null,"user_id": string,"warning": Database["public"]['Enums']["content_warning"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: number | null,"category_id"?: number | null,"created_at"?: string,"id"?: number,"kind": string,"publisher_id"?: number | null,"user_id"?: string,"warning"?: Database["public"]['Enums']["content_warning"] | null
                  }
                  Update: {
                    "author_id"?: number | null,"category_id"?: number | null,"created_at"?: string,"id"?: number,"kind"?: string,"publisher_id"?: number | null,"user_id"?: string,"warning"?: Database["public"]['Enums']["content_warning"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "authors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_publisher_id_fkey"
      columns: ["publisher_id"]
isOneToOne: false
      referencedRelation: "publishers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vouchers": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"description_en": string | null,"discount_type": Database["public"]['Enums']["discount_type"],"discount_value": number,"ends_at": string | null,"id": number,"is_active": boolean,"is_public": boolean,"max_discount": number | null,"min_order_value": number,"starts_at": string | null,"usage_limit": number | null,"used_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"description_en"?: string | null,"discount_type": Database["public"]['Enums']["discount_type"],"discount_value": number,"ends_at"?: string | null,"id"?: number,"is_active"?: boolean,"is_public"?: boolean,"max_discount"?: number | null,"min_order_value"?: number,"starts_at"?: string | null,"usage_limit"?: number | null,"used_count"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"description_en"?: string | null,"discount_type"?: Database["public"]['Enums']["discount_type"],"discount_value"?: number,"ends_at"?: string | null,"id"?: number,"is_active"?: boolean,"is_public"?: boolean,"max_discount"?: number | null,"min_order_value"?: number,"starts_at"?: string | null,"usage_limit"?: number | null,"used_count"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_seller_payouts":
{ Args: Record<PropertyKey, never>; Returns: {
              "amount": number,"created_at": string,"fee": number,"id": number,"listing_id": number,"order_code": string,"order_id": number,"order_status": Database["public"]['Enums']["order_status"],"paid_at": string,"payment_status": Database["public"]['Enums']["payment_status"],"price": number,"seller_id": string,"seller_name": string,"status": string,"title": string
            }[]
                           },
"can_delete_used_photo":
{ Args: { "p_name": string }; Returns: boolean
                           },
"can_upload_used_photo":
{ Args: { "p_name": string }; Returns: boolean
                           },
"cancel_order":
{ Args: { "p_order_id": number,"p_reason"?: string }; Returns: {
              "cancelled_reason": string | null,
"created_at": string,
"discount": number,
"id": number,
"idempotency_key": string | null,
"note": string | null,
"order_code": string,
"payment_method": Database["public"]['Enums']["payment_method"],
"payment_status": Database["public"]['Enums']["payment_status"],
"phone": string,
"province": string,
"recipient_name": string,
"shipping_fee": number,
"status": Database["public"]['Enums']["order_status"],
"street": string,
"subtotal": number,
"total": number,
"updated_at": string,
"user_id": string | null,
"voucher_code": string | null,
"voucher_id": number | null,
"ward": string
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"checkout_vouchers":
{ Args: Record<PropertyKey, never>; Returns: {
              "code": string,"description": string,"description_en": string,"discount": number,"discount_type": Database["public"]['Enums']["discount_type"],"discount_value": number,"ends_at": string,"max_discount": number,"min_order_value": number,"shortfall": number
            }[]
                           },
"consume_chat_quota":
{ Args: { "p_ip"?: string,"p_limits"?: Json,"p_token": string,"p_visitor"?: string }; Returns: Json
                           },
"consume_warning_quota":
{ Args: { "p_limits": Json }; Returns: Json
                           },
"create_used_listing":
{ Args: { "p_book_id": number,"p_condition": Database["public"]['Enums']["used_condition"],"p_description": string,"p_photos": (string)[],"p_price": number }; Returns: number
                           },
"generate_order_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_payout_paid":
{ Args: { "p_id": number }; Returns: undefined
                           },
"merge_cart":
{ Args: { "p_items": Json }; Returns: undefined
                           },
"my_used_sales":
{ Args: Record<PropertyKey, never>; Returns: {
              "amount": number,"fee": number,"listing_id": number,"order_status": Database["public"]['Enums']["order_status"],"payment_status": Database["public"]['Enums']["payment_status"],"payout_status": string,"price": number,"sold_at": string,"title": string
            }[]
                           },
"normalize_vi":
{ Args: { "txt": string }; Returns: string
                           },
"order_contact":
{ Args: { "p_order_id": number }; Returns: {
              "email": string,"locale": string
            }[]
                           },
"place_order":
{ Args: { "p_address_id": number,"p_expected_total"?: number,"p_idempotency_key"?: string,"p_note"?: string,"p_payment_method"?: Database["public"]['Enums']["payment_method"],"p_voucher_code"?: string }; Returns: {
              "cancelled_reason": string | null,
"created_at": string,
"discount": number,
"id": number,
"idempotency_key": string | null,
"note": string | null,
"order_code": string,
"payment_method": Database["public"]['Enums']["payment_method"],
"payment_status": Database["public"]['Enums']["payment_status"],
"phone": string,
"province": string,
"recipient_name": string,
"shipping_fee": number,
"status": Database["public"]['Enums']["order_status"],
"street": string,
"subtotal": number,
"total": number,
"updated_at": string,
"user_id": string | null,
"voucher_code": string | null,
"voucher_id": number | null,
"ward": string
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"place_used_order":
{ Args: { "p_address_id": number,"p_expected_total"?: number,"p_expected_updated_at": string,"p_idempotency_key"?: string,"p_listing_id": number,"p_note"?: string,"p_payment_method"?: Database["public"]['Enums']["payment_method"] }; Returns: {
              "cancelled_reason": string | null,
"created_at": string,
"discount": number,
"id": number,
"idempotency_key": string | null,
"note": string | null,
"order_code": string,
"payment_method": Database["public"]['Enums']["payment_method"],
"payment_status": Database["public"]['Enums']["payment_status"],
"phone": string,
"province": string,
"recipient_name": string,
"shipping_fee": number,
"status": Database["public"]['Enums']["order_status"],
"street": string,
"subtotal": number,
"total": number,
"updated_at": string,
"user_id": string | null,
"voucher_code": string | null,
"voucher_id": number | null,
"ward": string
            }
                          SetofOptions: {
        from: "*"
        to: "orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"quote_items":
{ Args: { "p_items": Json }; Returns: {
              "free_ship_from": number,"item_count": number,"shipping_fee": number,"subtotal": number,"total": number
            }[]
                           },
"quote_order":
{ Args: { "p_voucher_code"?: string }; Returns: {
              "discount": number,"free_ship_from": number,"item_count": number,"shipping_fee": number,"subtotal": number,"total": number
            }[]
                           },
"quote_used_order":
{ Args: { "p_listing_id": number }; Returns: {
              "available": boolean,"price": number,"shipping_fee": number,"total": number
            }[]
                           },
"review_used_listing":
{ Args: { "p_approve": boolean,"p_expected_status": Database["public"]['Enums']["used_listing_status"],"p_expected_updated_at": string,"p_id": number,"p_reason"?: string }; Returns: undefined
                           },
"review_warning_suggestion":
{ Args: { "p_approve": boolean,"p_expected_reviewed_at"?: string,"p_id": number,"p_labels": (Database["public"]['Enums']["content_warning"])[] }; Returns: number
                           },
"search_books":
{ Args: { "q": string }; Returns: {
              "avg_rating": number,
"category_id": number | null,
"content_warnings": (Database["public"]['Enums']["content_warning"])[],
"content_warnings_reviewed_at": string | null,
"cover_url": string | null,
"cover_width": number | null,
"created_at": string,
"description": string | null,
"description_en": string | null,
"dimensions": string | null,
"format": Database["public"]['Enums']["book_format"],
"id": number,
"is_active": boolean,
"is_featured": boolean,
"isbn": string | null,
"language": string,
"original_price": number | null,
"page_count": number | null,
"price": number,
"published_year": number | null,
"publisher_id": number | null,
"review_count": number,
"search_text": string | null,
"slug": string,
"sold_count": number,
"stock": number,
"subtitle": string | null,
"title": string,
"updated_at": string,
"weight_grams": number | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "books"
        isOneToOne: false
        isSetofReturn: true
      } },
"set_chat_quota_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"set_default_address":
{ Args: { "p_address_id": number }; Returns: undefined
                           },
"update_used_listing":
{ Args: { "p_condition": Database["public"]['Enums']["used_condition"],"p_description": string,"p_id": number,"p_photos": (string)[],"p_price": number }; Returns: undefined
                           },
"used_listing_quote":
{ Args: { "p_price": number }; Returns: {
              "fee": number,"payout": number
            }[]
                           },
"withdraw_used_listing":
{ Args: { "p_id": number }; Returns: undefined
                           }
          }
          Enums: {
            "book_format": "paperback"|"hardcover"|"boxset","content_warning": "violence"|"loss"|"self_harm"|"adult"|"other_sensitive","discount_type": "percent"|"fixed","order_status": "pending"|"confirmed"|"shipping"|"delivered"|"cancelled","payment_method": "cod"|"bank_transfer","payment_status": "unpaid"|"paid"|"refunded","used_condition": "like_new"|"good"|"fair"|"worn","used_listing_status": "pending"|"approved"|"rejected"|"sold"|"withdrawn","user_role": "customer"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "book_format": ["paperback", "hardcover", "boxset"],"content_warning": ["violence", "loss", "self_harm", "adult", "other_sensitive"],"discount_type": ["percent", "fixed"],"order_status": ["pending", "confirmed", "shipping", "delivered", "cancelled"],"payment_method": ["cod", "bank_transfer"],"payment_status": ["unpaid", "paid", "refunded"],"used_condition": ["like_new", "good", "fair", "worn"],"used_listing_status": ["pending", "approved", "rejected", "sold", "withdrawn"],"user_role": ["customer", "admin"]
          }
        }
} as const
