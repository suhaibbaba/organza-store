// Reading a customer's location out of the Google Maps link they send (spec.md "Customer information").
import { describe, expect, it } from "vitest";
import { coordinatesFromMapLink, isGoogleMapsLink, isShortMapLink } from "@store/shared/lib/mapLink";

describe("coordinatesFromMapLink", () => {
  it("prefers the dropped pin over the map's centre", () => {
    const link = "https://www.google.com/maps/place/Nablus/@32.2,35.1,15z/data=!3m1!4b1!4m6!3m5!3d32.2211!4d35.2544";
    expect(coordinatesFromMapLink(link)).toEqual({ latitude: 32.2211, longitude: 35.2544 });
  });

  it("reads a query, a search path and a centre", () => {
    expect(coordinatesFromMapLink("https://maps.google.com/?q=32.313,35.028")).toEqual({
      latitude: 32.313,
      longitude: 35.028,
    });
    expect(coordinatesFromMapLink("https://www.google.com/maps/search/?api=1&query=31.9%2C35.2")).toEqual({
      latitude: 31.9,
      longitude: 35.2,
    });
    expect(coordinatesFromMapLink("https://www.google.com/maps/search/32.1,+35.3")).toEqual({
      latitude: 32.1,
      longitude: 35.3,
    });
    expect(coordinatesFromMapLink("https://www.google.com/maps/@-33.86,151.2,12z")).toEqual({
      latitude: -33.86,
      longitude: 151.2,
    });
  });

  it("takes a bare coordinate pair", () => {
    expect(coordinatesFromMapLink(" 32.313, 35.028 ")).toEqual({ latitude: 32.313, longitude: 35.028 });
  });

  it("finds nothing in a short link, a place name or an out-of-range pair", () => {
    expect(coordinatesFromMapLink("https://maps.app.goo.gl/AbCdEf123")).toBeNull();
    expect(coordinatesFromMapLink("https://www.google.com/maps/place/Nablus")).toBeNull();
    expect(coordinatesFromMapLink("95.1, 35.2")).toBeNull();
  });
});

describe("which links the server may follow", () => {
  it("allows Google's map pages and short links over https only", () => {
    expect(isShortMapLink("https://maps.app.goo.gl/AbCdEf123")).toBe(true);
    expect(isGoogleMapsLink("https://www.google.com/maps/place/x")).toBe(true);
    expect(isGoogleMapsLink("https://maps.google.co.il/?q=x")).toBe(true);
    expect(isGoogleMapsLink("http://maps.app.goo.gl/x")).toBe(false);
    expect(isGoogleMapsLink("https://www.google.com/search?q=x")).toBe(false);
    expect(isGoogleMapsLink("https://google.com.evil.example/maps")).toBe(false);
    expect(isGoogleMapsLink("https://169.254.169.254/maps")).toBe(false);
  });
});
