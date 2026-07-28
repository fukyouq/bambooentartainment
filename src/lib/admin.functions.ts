import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RANKS: Record<string, number> = {
  overseer_company: 4,
  overseer_entertainment: 3,
  supervisor: 2,
  journalist: 1,
  user: 0,
};

const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  username: z.string().trim().min(2).max(60),
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: z.string().min(4).max(20),
  role: z.enum(["overseer_entertainment", "supervisor", "journalist", "user"]),
});

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    const adderRank = (rows ?? []).reduce((acc, r) => Math.max(acc, RANKS[r.role] ?? 0), 0);
    if (adderRank < 1) throw new Error("You are not allowed to add users.");
    if (RANKS[data.role] >= adderRank) {
      throw new Error("You cannot add a user with your own role or a higher role.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username,
        full_name: data.fullName,
        date_of_birth: data.dateOfBirth,
        role: data.role,
      },
    });
    if (createError) throw new Error(createError.message);

    return { id: created.user?.id ?? null };
  });