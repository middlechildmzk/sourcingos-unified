import fs from 'node:fs'

const path = 'next-public/app/api/workbench/save-source-profile/route.ts'
let text = fs.readFileSync(path, 'utf8')

const before = `    const { data: profileData, error: profileError } = existingProfile
      ? await sb.from('source_profiles')
          .update(profilePayload)
          .eq('id', existingProfile.id)
          .eq('owner_id', ownerId)
          .select('id,candidate_id')
          .single()
      : await sb.from('source_profiles')
          .insert(profilePayload)
          .select('id,candidate_id')
          .single()`

const after = `    // Upsert closes the race where two first-time saves both pass the lookup.
    // candidate_id is intentionally omitted from profilePayload, so an existing
    // canonical link is preserved rather than overwritten.
    const { data: profileData, error: profileError } = await sb
      .from('source_profiles')
      .upsert(profilePayload, { onConflict: 'owner_id,source,source_profile_id' })
      .select('id,candidate_id')
      .single()`

if (!text.includes(before)) {
  if (!text.includes(after)) throw new Error('Save-route upsert marker not found')
} else {
  text = text.replace(before, after)
}

fs.writeFileSync(path, text)
console.log('Source-profile first-save race closed with upsert')
