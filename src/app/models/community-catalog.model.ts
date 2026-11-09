export type CommunityCategory = 'movie' | 'tv' | 'book' | 'music' | 'skincare' | 'fashion' | 'travel' | 'other';

export interface CommunityField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'url' | 'textarea';
  required?: boolean;
}
export interface CommunityCategoryOption {
  id: CommunityCategory;
  label: string;
  icon: string;
  description: string;
  categorySlug: string;
  fields: CommunityField[];
}

export const COMMUNITY_CATEGORIES: CommunityCategoryOption[] = [
  { id:'movie', label:'Película', icon:'🎬', description:'Añade una película.', categorySlug:'peliculas-series', fields:[
    {key:'director',label:'Dirección',placeholder:'Nombre de la persona directora'},
    {key:'duration',label:'Duración (minutos)',type:'number',placeholder:'120'},
    {key:'cast',label:'Reparto principal',placeholder:'Nombres separados por comas'}]},
  { id:'tv', label:'Serie', icon:'📺', description:'Añade una serie o drama.', categorySlug:'peliculas-series', fields:[
    {key:'seasons',label:'Temporadas',type:'number',placeholder:'1'},
    {key:'episodes',label:'Episodios',type:'number',placeholder:'16'},
    {key:'cast',label:'Reparto principal',placeholder:'Nombres separados por comas'}]},
  { id:'book', label:'Libro', icon:'📚', description:'Añade un libro, novela o cómic.', categorySlug:'libros', fields:[
    {key:'author',label:'Autor/a',placeholder:'Nombre del autor/a',required:true},
    {key:'pages',label:'Páginas',type:'number',placeholder:'320'},
    {key:'publisher',label:'Editorial',placeholder:'Editorial'},
    {key:'isbn',label:'ISBN',placeholder:'ISBN'}]},
  { id:'music', label:'Música', icon:'🎵', description:'Añade una canción o lanzamiento.', categorySlug:'musica', fields:[
    {key:'artist',label:'Artista',placeholder:'Artista o grupo',required:true},
    {key:'releaseKind',label:'Tipo de lanzamiento',placeholder:'Álbum, single, EP…'},
    {key:'trackCount',label:'Número de pistas',type:'number',placeholder:'10'},
    {key:'label',label:'Discográfica',placeholder:'Discográfica'}]},
  { id:'skincare', label:'Skincare', icon:'🧴', description:'Añade un producto de cuidado de la piel.', categorySlug:'skincare', fields:[
    {key:'brand',label:'Marca',placeholder:'Marca',required:true},
    {key:'productType',label:'Tipo de producto',placeholder:'Limpiador, sérum, crema…',required:true},
    {key:'skinTypes',label:'Tipo de piel',placeholder:'Seca, grasa, mixta…'},
    {key:'size',label:'Contenido',placeholder:'50 ml'}]},
  { id:'fashion', label:'Moda y estilo', icon:'👗', description:'Comparte prendas o accesorios.', categorySlug:'moda-estilo', fields:[
    {key:'brand',label:'Marca',placeholder:'Marca'},
    {key:'itemType',label:'Tipo de artículo',placeholder:'Prenda, calzado, accesorio…',required:true},
    {key:'style',label:'Estilo',placeholder:'Casual, streetwear…'},
    {key:'color',label:'Color',placeholder:'Color principal'}]},
  { id:'travel', label:'Viajes', icon:'✈️', description:'Recomienda un destino o lugar.', categorySlug:'viajes', fields:[
    {key:'destination',label:'Destino o lugar',placeholder:'Nombre del lugar',required:true},
    {key:'city',label:'Ciudad',placeholder:'Ciudad'},
    {key:'country',label:'País',placeholder:'País'},
    {key:'placeType',label:'Tipo de lugar',placeholder:'Museo, restaurante, naturaleza…'}]},
  { id:'other', label:'Otros', icon:'✨', description:'Añade cualquier otro descubrimiento.', categorySlug:'otros', fields:[
    {key:'itemType',label:'Tipo de contenido',placeholder:'¿Qué estás añadiendo?',required:true},
    {key:'reference',label:'Enlace de referencia',type:'url',placeholder:'https://…'}]}
];
