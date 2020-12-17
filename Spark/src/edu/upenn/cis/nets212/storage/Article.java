package edu.upenn.cis.nets212.storage;

/**
 * Article class for the purpose of JSON parser/object mapping
 * @author nets212
 *
 */
public class Article {
	public int id;
	public String category;
	public String headline;
	public String link;
	public String date;
	public String authors;
	public String short_description;
	public Article (String category, String headline, String authors, String link, 
			String short_description, String date) {
		this.category = category;
		this.headline = headline;
		this.link = link;
		this.date = date;
		this.authors = authors;
		this.short_description = short_description;
		id = headline.hashCode();
	}
	public void setHeadline(String headline) {
		this.headline = headline;
		this.id = headline.hashCode();
	}
	
	public void setId() {
		id = headline.hashCode();
	}
}