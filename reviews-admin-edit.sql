-- صلاحية تعديل التقييم لصاحبته (عشان المشتري تعدّل تقييمها)
drop policy if exists "reviews_update_own" on public.product_reviews;
create policy "reviews_update_own" on public.product_reviews
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
