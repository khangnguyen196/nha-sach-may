export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          created_at: string
          id: number
          is_default: boolean
          phone: string
          province: string
          recipient_name: string
          street: string
          user_id: string
          ward: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_default?: boolean
          phone: string
          province: string
          recipient_name: string
          street: string
          user_id: string
          ward: string
        }
        Update: {
          created_at?: string
          id?: number
          is_default?: boolean
          phone?: string
          province?: string
          recipient_name?: string
          street?: string
          user_id?: string
          ward?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          bio: string | null
          bio_en: string | null
          created_at: string
          id: number
          name: string
          photo_url: string | null
          slug: string
        }
        Insert: {
          bio?: string | null
          bio_en?: string | null
          created_at?: string
          id?: number
          name: string
          photo_url?: string | null
          slug: string
        }
        Update: {
          bio?: string | null
          bio_en?: string | null
          created_at?: string
          id?: number
          name?: string
          photo_url?: string | null
          slug?: string
        }
        Relationships: []
      }
      book_authors: {
        Row: {
          author_id: number
          book_id: number
          role: string
        }
        Insert: {
          author_id: number
          book_id: number
          role?: string
        }
        Update: {
          author_id?: number
          book_id?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_authors_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_images: {
        Row: {
          book_id: number
          id: number
          sort_order: number
          url: string
        }
        Insert: {
          book_id: number
          id?: number
          sort_order?: number
          url: string
        }
        Update: {
          book_id?: number
          id?: number
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_images_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          avg_rating: number
          category_id: number | null
          cover_url: string | null
          created_at: string
          description: string | null
          description_en: string | null
          dimensions: string | null
          format: Database["public"]["Enums"]["book_format"]
          id: number
          is_active: boolean
          is_featured: boolean
          isbn: string | null
          language: string
          original_price: number | null
          page_count: number | null
          price: number
          published_year: number | null
          publisher_id: number | null
          review_count: number
          search_text: string | null
          slug: string
          sold_count: number
          stock: number
          subtitle: string | null
          title: string
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          avg_rating?: number
          category_id?: number | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          dimensions?: string | null
          format?: Database["public"]["Enums"]["book_format"]
          id?: number
          is_active?: boolean
          is_featured?: boolean
          isbn?: string | null
          language?: string
          original_price?: number | null
          page_count?: number | null
          price: number
          published_year?: number | null
          publisher_id?: number | null
          review_count?: number
          search_text?: string | null
          slug: string
          sold_count?: number
          stock?: number
          subtitle?: string | null
          title: string
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          avg_rating?: number
          category_id?: number | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          description_en?: string | null
          dimensions?: string | null
          format?: Database["public"]["Enums"]["book_format"]
          id?: number
          is_active?: boolean
          is_featured?: boolean
          isbn?: string | null
          language?: string
          original_price?: number | null
          page_count?: number | null
          price?: number
          published_year?: number | null
          publisher_id?: number | null
          review_count?: number
          search_text?: string | null
          slug?: string
          sold_count?: number
          stock?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "books_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          book_id: number
          created_at: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: number
          created_at?: string
          quantity: number
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: number
          created_at?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          description_en: string | null
          id: number
          is_active: boolean
          name: string
          name_en: string | null
          parent_id: number | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          id?: number
          is_active?: boolean
          name: string
          name_en?: string | null
          parent_id?: number | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          id?: number
          is_active?: boolean
          name?: string
          name_en?: string | null
          parent_id?: number | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          book_id: number | null
          cover_url: string | null
          id: number
          line_total: number | null
          order_id: number
          quantity: number
          title: string
          unit_price: number
        }
        Insert: {
          book_id?: number | null
          cover_url?: string | null
          id?: number
          line_total?: number | null
          order_id: number
          quantity: number
          title: string
          unit_price: number
        }
        Update: {
          book_id?: number | null
          cover_url?: string | null
          id?: number
          line_total?: number | null
          order_id?: number
          quantity?: number
          title?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancelled_reason: string | null
          created_at: string
          discount: number
          id: number
          note: string | null
          order_code: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          province: string
          recipient_name: string
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
          voucher_code: string | null
          voucher_id: number | null
          ward: string
        }
        Insert: {
          cancelled_reason?: string | null
          created_at?: string
          discount?: number
          id?: number
          note?: string | null
          order_code?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          province: string
          recipient_name: string
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
          voucher_code?: string | null
          voucher_id?: number | null
          ward: string
        }
        Update: {
          cancelled_reason?: string | null
          created_at?: string
          discount?: number
          id?: number
          note?: string | null
          order_code?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          province?: string
          recipient_name?: string
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          street?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          voucher_code?: string | null
          voucher_id?: number | null
          ward?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      publishers: {
        Row: {
          created_at: string
          description: string | null
          description_en: string | null
          id: number
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          id?: number
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          book_id: number
          content: string | null
          created_at: string
          display_name: string | null
          id: number
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: number
          content?: string | null
          created_at?: string
          display_name?: string | null
          id?: number
          rating: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          book_id?: number
          content?: string | null
          created_at?: string
          display_name?: string | null
          id?: number
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          code: string
          created_at: string
          description: string | null
          description_en: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at: string | null
          id: number
          is_active: boolean
          max_discount: number | null
          min_order_value: number
          starts_at: string | null
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          description_en?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at?: string | null
          id?: number
          is_active?: boolean
          max_discount?: number | null
          min_order_value?: number
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          description_en?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          ends_at?: string | null
          id?: number
          is_active?: boolean
          max_discount?: number | null
          min_order_value?: number
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_order: {
        Args: { p_order_id: number; p_reason?: string }
        Returns: {
          cancelled_reason: string | null
          created_at: string
          discount: number
          id: number
          note: string | null
          order_code: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          province: string
          recipient_name: string
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
          voucher_code: string | null
          voucher_id: number | null
          ward: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_order_code: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      merge_cart: { Args: { p_items: Json }; Returns: undefined }
      normalize_vi: { Args: { txt: string }; Returns: string }
      place_order: {
        Args: {
          p_address_id: number
          p_note?: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_voucher_code?: string
        }
        Returns: {
          cancelled_reason: string | null
          created_at: string
          discount: number
          id: number
          note: string | null
          order_code: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          province: string
          recipient_name: string
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
          voucher_code: string | null
          voucher_id: number | null
          ward: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      quote_items: {
        Args: { p_items: Json }
        Returns: {
          free_ship_from: number
          item_count: number
          shipping_fee: number
          subtotal: number
          total: number
        }[]
      }
      quote_order: {
        Args: { p_voucher_code?: string }
        Returns: {
          discount: number
          free_ship_from: number
          item_count: number
          shipping_fee: number
          subtotal: number
          total: number
        }[]
      }
      search_books: {
        Args: { q: string }
        Returns: {
          avg_rating: number
          category_id: number | null
          cover_url: string | null
          created_at: string
          description: string | null
          description_en: string | null
          dimensions: string | null
          format: Database["public"]["Enums"]["book_format"]
          id: number
          is_active: boolean
          is_featured: boolean
          isbn: string | null
          language: string
          original_price: number | null
          page_count: number | null
          price: number
          published_year: number | null
          publisher_id: number | null
          review_count: number
          search_text: string | null
          slug: string
          sold_count: number
          stock: number
          subtitle: string | null
          title: string
          updated_at: string
          weight_grams: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "books"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_default_address: {
        Args: { p_address_id: number }
        Returns: undefined
      }
    }
    Enums: {
      book_format: "paperback" | "hardcover" | "boxset"
      discount_type: "percent" | "fixed"
      order_status:
        | "pending"
        | "confirmed"
        | "shipping"
        | "delivered"
        | "cancelled"
      payment_method: "cod" | "bank_transfer"
      payment_status: "unpaid" | "paid" | "refunded"
      user_role: "customer" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      book_format: ["paperback", "hardcover", "boxset"],
      discount_type: ["percent", "fixed"],
      order_status: [
        "pending",
        "confirmed",
        "shipping",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cod", "bank_transfer"],
      payment_status: ["unpaid", "paid", "refunded"],
      user_role: ["customer", "admin"],
    },
  },
} as const
