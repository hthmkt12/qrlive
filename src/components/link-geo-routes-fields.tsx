import {
  type FieldArrayWithId,
  type FieldErrors,
  type UseFieldArrayAppend,
  type UseFieldArrayRemove,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { Globe, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LinkFormInput } from "@/lib/schemas";
import { COUNTRIES } from "@/lib/types";

interface LinkGeoRoutesFieldsProps {
  append: UseFieldArrayAppend<LinkFormInput, "geoRoutes">;
  errors: FieldErrors<LinkFormInput>;
  fields: FieldArrayWithId<LinkFormInput, "geoRoutes", "id">[];
  emptyMessage: string;
  register: UseFormRegister<LinkFormInput>;
  remove: UseFieldArrayRemove;
  setValue: UseFormSetValue<LinkFormInput>;
  watch: UseFormWatch<LinkFormInput>;
}

export function LinkGeoRoutesFields({
  append,
  errors,
  fields,
  emptyMessage,
  register,
  remove,
  setValue,
  watch,
}: LinkGeoRoutesFieldsProps) {
  const handleCountryChange = (index: number, code: string) => {
    const country = COUNTRIES.find((item) => item.code === code);
    setValue(`geoRoutes.${index}.countryCode`, code);
    setValue(`geoRoutes.${index}.country`, country?.name || "");
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          Chuyển hướng theo quốc gia
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ country: "", countryCode: "", targetUrl: "" })}>
          <Plus className="mr-1 h-3 w-3" /> Thêm
        </Button>
      </div>

      {fields.length === 0 && <p className="text-xs text-muted-foreground">{emptyMessage}</p>}

      {fields.map((field, index) => (
        <div key={field.id} className="mb-3 space-y-1">
          <div className="flex items-center gap-2">
            <select
              value={watch(`geoRoutes.${index}.countryCode`) || ""}
              onChange={(event) => handleCountryChange(index, event.target.value)}
              className="h-9 flex-shrink-0 rounded-md border border-border bg-secondary px-3 text-sm"
            >
              <option value="">Chọn quốc gia</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
            <Input placeholder="URL đích" {...register(`geoRoutes.${index}.targetUrl`)} className="flex-1" />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <Input
            placeholder="Bypass URL (nếu bị chặn) - ví dụ: https://translate.google.com/translate?u=..."
            {...register(`geoRoutes.${index}.bypassUrl`)}
            className="h-8 text-xs text-muted-foreground"
          />
          {errors.geoRoutes?.[index]?.countryCode && <p className="text-xs text-destructive">{errors.geoRoutes[index]?.countryCode?.message}</p>}
          {errors.geoRoutes?.[index]?.targetUrl && <p className="text-xs text-destructive">{errors.geoRoutes[index]?.targetUrl?.message}</p>}
          {errors.geoRoutes?.[index]?.bypassUrl && <p className="text-xs text-destructive">{errors.geoRoutes[index]?.bypassUrl?.message}</p>}
        </div>
      ))}
    </div>
  );
}
