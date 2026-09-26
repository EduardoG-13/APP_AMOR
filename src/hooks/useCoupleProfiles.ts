import { useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { CoupleProfileRecord, UserProfile } from '../types';

const BUCKET = 'avatares';

export function useCoupleProfiles() {
  const queryClient = useQueryClient();
  const channelId = useId();

  useEffect(() => {
    const channel = supabase
      .channel(`couple-profiles${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['couple_profiles'] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, channelId]);

  const query = useQuery({
    queryKey: ['couple_profiles'],
    queryFn: async (): Promise<CoupleProfileRecord[]> => {
      const { data, error } = await supabase.from('couple_profiles').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (input: {
      profile: UserProfile;
      displayName?: string;
      avatarUrl?: string | null;
    }) => {
      const payload: Record<string, unknown> = { profile: input.profile };
      if (input.displayName !== undefined) payload.display_name = input.displayName.trim();
      if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;

      const { error } = await supabase
        .from('couple_profiles')
        .upsert(payload, { onConflict: 'profile' });

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['couple_profiles'] }),
  });

  /** Manda a foto pro Storage e devolve a URL pública. */
  const uploadAvatar = useMutation({
    mutationFn: async (input: { profile: UserProfile; file: File }) => {
      if (!input.file.type.startsWith('image/')) {
        throw new Error('Escolha uma imagem (jpg, png ou webp).');
      }
      if (input.file.size > 5 * 1024 * 1024) {
        throw new Error('A imagem passou de 5 MB. Escolha uma menor.');
      }

      const extension = input.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      // Nome novo a cada envio: sem isso o cache do navegador
      // continuaria mostrando a foto antiga.
      const path = `${input.profile}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, input.file, { upsert: true, cacheControl: '3600' });

      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;

      await save.mutateAsync({ profile: input.profile, avatarUrl: publicUrl });
      return publicUrl;
    },
  });

  const byProfile = (profile: UserProfile) =>
    (query.data || []).find((item) => item.profile === profile) || null;

  return {
    profiles: query.data || [],
    byProfile,
    isLoading: query.isLoading,
    save: save.mutateAsync,
    isSaving: save.isPending,
    uploadAvatar: uploadAvatar.mutateAsync,
    isUploading: uploadAvatar.isPending,
    uploadError: uploadAvatar.error as Error | null,
  };
}
