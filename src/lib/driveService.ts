export interface DriveImageFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailLink: string;
  modifiedTime: string;
}

export async function listDriveImages(
  accessToken: string,
  searchQuery = ''
): Promise<DriveImageFile[]> {
  const cleanSearch = searchQuery.trim().replace(/'/g, "\\'");
  const queryParts = [
    "mimeType contains 'image/'",
    'trashed = false',
  ];
  if (cleanSearch) {
    queryParts.push(`name contains '${cleanSearch}'`);
  }

  const params = new URLSearchParams({
    q: queryParts.join(' and '),
    fields: 'files(id,name,mimeType,size,thumbnailLink,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '36',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error('DRIVE_AUTH_EXPIRED');
  }
  if (!res.ok) {
    throw new Error(`Không thể tải danh sách ảnh từ Google Drive (${res.status}).`);
  }

  const data = (await res.json()) as {
    files?: {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
      thumbnailLink?: string;
      modifiedTime?: string;
    }[];
  };

  return (data.files || []).map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: Number(file.size || 0),
    thumbnailLink: file.thumbnailLink || '',
    modifiedTime: file.modifiedTime || '',
  }));
}

export async function downloadDriveImageBlob(
  accessToken: string,
  fileId: string
): Promise<Blob> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error('DRIVE_AUTH_EXPIRED');
  }
  if (!res.ok) {
    throw new Error(`Không thể tải ảnh từ Google Drive (${res.status}).`);
  }

  return res.blob();
}
